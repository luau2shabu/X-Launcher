using System.Text.Json;
using XLauncher.Infrastructure;

namespace XLauncher.Bridge;

/// <summary>
/// JSON-RPC between the web UI and the host. The UI posts <c>{id, method, params}</c>;
/// the host answers <c>{id, result}</c> or <c>{id, error}</c>, and pushes <c>{event, data}</c> on its own.
/// </summary>
public sealed class BridgeHost
{
    readonly Dictionary<string, Func<JsonElement, Task<object?>>> _handlers = new(StringComparer.Ordinal);

    /// <summary>Raised with a JSON string for every event the host pushes to the UI.</summary>
    public event Action<string>? Outgoing;

    public void On(string method, Func<JsonElement, Task<object?>> handler) => _handlers[method] = handler;

    public void On(string method, Func<JsonElement, object?> handler) =>
        _handlers[method] = p => Task.FromResult(handler(p));

    public bool Has(string method) => _handlers.ContainsKey(method);

    /// <summary>Runs one request and returns the response JSON, or null for fire-and-forget requests without an id.</summary>
    public async Task<string?> DispatchAsync(string json)
    {
        long? id = null;
        string? method = null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("id", out var idElement) && idElement.ValueKind == JsonValueKind.Number)
                id = idElement.GetInt64();
            method = root.TryGetProperty("method", out var m) ? m.GetString() : null;
            var parameters = root.TryGetProperty("params", out var p) ? p.Clone() : default;

            if (method is null || !_handlers.TryGetValue(method, out var handler))
                return Error(id, $"Unknown method '{method}'");

            var result = await handler(parameters);
            return id is null ? null : JsonSerializer.Serialize(new { id, result }, Json.Options);
        }
        catch (Exception ex)
        {
            Log.Error($"Bridge call '{method}' failed", ex);
            return Error(id, ex.Message);
        }
    }

    public void Emit(string name, object? data = null) =>
        Outgoing?.Invoke(JsonSerializer.Serialize(new { @event = name, data }, Json.Options));

    static string? Error(long? id, string message) =>
        id is null ? null : JsonSerializer.Serialize(new { id, error = message }, Json.Options);
}

/// <summary>Typed access to request params, which may be absent (<see cref="JsonValueKind.Undefined"/>).</summary>
public static class BridgeParams
{
    public static string Req(this JsonElement p, string name) =>
        p.Str(name) is { Length: > 0 } s ? s : throw new ArgumentException($"Missing parameter '{name}'");

    public static string? Opt(this JsonElement p, string name) => p.Str(name);

    public static int Num(this JsonElement p, string name, int fallback) => p.Has(name) ? p.Int(name, fallback) : fallback;

    public static bool Flag(this JsonElement p, string name) => p.Bool(name);
}
