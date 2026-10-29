using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text.Json;
using QRCoder;
using XLauncher.Config;
using XLauncher.Infrastructure;

namespace XLauncher.Auth;

public sealed record GoogleClient(string ClientId, string ClientSecret);

/// <summary>
/// "Sign in with Google" for a profile using the OAuth device flow (the one TVs use):
/// the TV shows a code and a QR code, the user approves on a phone at google.com/device,
/// and we read the name, email and photo. Tokens are used once and never stored.
/// Needs an OAuth client of type "TVs and Limited Input devices" in google-oauth.json.
/// </summary>
public sealed class GoogleSignIn(SettingsStore settings) : IDisposable
{
    const string DeviceCodeUrl = "https://oauth2.googleapis.com/device/code";
    const string TokenUrl = "https://oauth2.googleapis.com/token";
    const string UserInfoUrl = "https://openidconnect.googleapis.com/v1/userinfo";
    const string Scopes = "openid email profile";

    sealed class Session(string profileId, string deviceCode, DateTime expires, int interval)
    {
        public string ProfileId { get; } = profileId;
        public string DeviceCode { get; } = deviceCode;
        public DateTime Expires { get; } = expires;
        public int Interval { get; set; } = interval;
    }

    readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(20) };
    readonly ConcurrentDictionary<string, Session> _sessions = new();

    public static GoogleClient? LoadClient()
    {
        foreach (var file in Paths.GoogleClientFiles)
        {
            try
            {
                if (!File.Exists(file)) continue;
                using var doc = JsonDocument.Parse(File.ReadAllText(file));
                // Accept both our flat format and the JSON Google Cloud Console downloads ({"installed": {...}})
                var root = doc.RootElement.TryGetProperty("installed", out var installed) ? installed : doc.RootElement;
                if ((root.Str("client_id") ?? root.Str("clientId")) is { Length: > 0 } id
                    && (root.Str("client_secret") ?? root.Str("clientSecret")) is { Length: > 0 } secret)
                    return new GoogleClient(id, secret);
            }
            catch (Exception ex) when (ex is JsonException or IOException)
            {
                Log.Warn($"Ignoring unreadable {file}", ex);
            }
        }
        return null;
    }

    public object Status() => new { configured = LoadClient() is not null };

    public async Task<object> StartAsync(string profileId)
    {
        var client = LoadClient() ?? throw new InvalidOperationException("Google sign-in is not set up on this PC (google-oauth.json is missing)");
        using var response = await _http.PostAsync(DeviceCodeUrl, new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = client.ClientId,
            ["scope"] = Scopes,
        }));
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = doc.RootElement;
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(root.Str("error_description") ?? root.Str("error") ?? $"HTTP {(int)response.StatusCode}");

        var verificationUrl = root.Str("verification_url") ?? root.Str("verification_uri") ?? "https://www.google.com/device";
        var expiresIn = root.Int("expires_in", 1800);
        var interval = root.Int("interval", 5);
        var id = Guid.NewGuid().ToString("N");
        _sessions[id] = new Session(profileId, root.Str("device_code")!, DateTime.UtcNow.AddSeconds(expiresIn), interval);
        return new
        {
            session = id,
            userCode = root.Str("user_code"),
            verificationUrl,
            qr = QrDataUri(verificationUrl),
            expiresIn,
            interval,
        };
    }

    /// <summary>One token check. Status: pending | done | denied | expired.</summary>
    public async Task<object> PollAsync(string sessionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var session)) return new { status = "expired" };
        if (DateTime.UtcNow > session.Expires)
        {
            _sessions.TryRemove(sessionId, out _);
            return new { status = "expired" };
        }
        var client = LoadClient() ?? throw new InvalidOperationException("Google sign-in is not set up");
        using var response = await _http.PostAsync(TokenUrl, new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = client.ClientId,
            ["client_secret"] = client.ClientSecret,
            ["device_code"] = session.DeviceCode,
            ["grant_type"] = "urn:ietf:params:oauth:grant-type:device_code",
        }));
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = doc.RootElement;

        if (!response.IsSuccessStatusCode)
        {
            var status = PollStatus(root.Str("error"));
            if (status == "slow_down") session.Interval += 5;
            if (status is "denied" or "expired") _sessions.TryRemove(sessionId, out _);
            return new { status = status == "slow_down" ? "pending" : status, interval = session.Interval };
        }

        _sessions.TryRemove(sessionId, out _);
        var profile = await ReadProfileAsync(root.Str("access_token")!);
        var picture = profile.Picture is null ? null : await SavePictureAsync(session.ProfileId, profile.Picture);
        var updated = settings.Update(s =>
        {
            var p = s.Profiles.FirstOrDefault(x => x.Id == session.ProfileId);
            if (p is null) return;
            if (!string.IsNullOrWhiteSpace(profile.Name)) p.Name = profile.Name;
            p.Email = profile.Email;
            p.Picture = picture;
        });
        Log.Info("Profile signed in with Google");
        return new { status = "done", settings = updated };
    }

    public AppSettings SignOut(string profileId)
    {
        var file = Path.Combine(Paths.Avatars, $"{profileId}.jpg");
        if (File.Exists(file)) File.Delete(file);
        return settings.Update(s =>
        {
            var p = s.Profiles.FirstOrDefault(x => x.Id == profileId);
            if (p is null) return;
            p.Email = null;
            p.Picture = null;
        });
    }

    /// <summary>Maps Google's device-flow error codes to our status values.</summary>
    public static string PollStatus(string? error) => error switch
    {
        "authorization_pending" => "pending",
        "slow_down" => "slow_down",
        "access_denied" => "denied",
        "expired_token" => "expired",
        _ => throw new InvalidOperationException($"Google sign-in failed ({error ?? "unknown error"})"),
    };

    sealed record GoogleProfile(string? Name, string? Email, string? Picture);

    async Task<GoogleProfile> ReadProfileAsync(string accessToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, UserInfoUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var response = await _http.SendAsync(request);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var r = doc.RootElement;
        return new GoogleProfile(r.Str("name") ?? r.Str("given_name"), r.Str("email"), r.Str("picture"));
    }

    async Task<string?> SavePictureAsync(string profileId, string url)
    {
        try
        {
            // Google photo URLs end in "=s96-c"; ask for a TV-sized one
            var big = System.Text.RegularExpressions.Regex.Replace(url, @"=s\d+(-c)?$", "=s256-c");
            var bytes = await _http.GetByteArrayAsync(big);
            Directory.CreateDirectory(Paths.Avatars);
            var file = $"{profileId}.jpg";
            await File.WriteAllBytesAsync(Path.Combine(Paths.Avatars, file), bytes);
            return $"https://img.xlauncher.local/avatar/{file}?v={DateTime.UtcNow.Ticks}";
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException)
        {
            Log.Warn("Could not download the Google profile photo", ex);
            return null;
        }
    }

    static string QrDataUri(string text) =>
        "data:image/png;base64," + Convert.ToBase64String(PngByteQRCodeHelper.GetQRCode(text, QRCodeGenerator.ECCLevel.M, 12));

    public void Dispose() => _http.Dispose();
}
