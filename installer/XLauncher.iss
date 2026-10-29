; X Launcher setup wizard (Inno Setup 6.5+). Build with ..\build-installer.ps1, which publishes the app first.
; Plex HTPC is required: if it is missing, the wizard downloads the current version from plex.tv and runs its installer.

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#define AppName "X Launcher"
#define AppExe "XLauncher.exe"
#define AppSource "..\dist\XLauncher"
#define PlexHtpcApi "https://plex.tv/api/downloads/7.json"
; Used only if the Plex download API cannot be read
#define PlexHtpcFallback "https://downloads.plex.tv/htpc/1.71.1.346-f62ce923/windows/PlexHTPC-1.71.1.346-f62ce923-x86_64.exe"
#define WebView2Bootstrapper "https://go.microsoft.com/fwlink/p/?LinkId=2124703"

[Setup]
AppId={{6C1E7A52-3B8E-4C1D-9F2A-58A0D4E7B931}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=Angstrom X Co., Ltd.
AppPublisherURL=https://www.angstromx.co.th
AppSupportURL=https://github.com/luau2shabu/X-Launcher
AppCopyright=© Angstrom X Co., Ltd.
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir=..\dist
OutputBaseFilename=XLauncher-Setup-{#AppVersion}
SetupIconFile=..\src\XLauncher\Assets\xlauncher.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
WizardStyle=modern
WizardImageFile=wizard-large-100.bmp,wizard-large-150.bmp,wizard-large-200.bmp
WizardSmallImageFile=wizard-small-100.bmp,wizard-small-150.bmp,wizard-small-200.bmp
Compression=lzma2/ultra64
SolidCompression=yes
CloseApplications=yes
VersionInfoVersion={#AppVersion}
VersionInfoCompany=Angstrom X Co., Ltd.
VersionInfoProductName={#AppName}

[Languages]
Name: "th"; MessagesFile: "compiler:Languages\Thai.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
th.PlexPageTitle=ต้องติดตั้ง Plex HTPC
th.PlexPageSubtitle=X Launcher ใช้ Plex HTPC เล่นหนังและซีรีส์จาก Plex
th.PlexPageText=ไม่พบ Plex HTPC ในเครื่องนี้ ต้องติดตั้งก่อนจึงจะติดตั้ง X Launcher ต่อได้%n%nกดปุ่มด้านล่างเพื่อดาวน์โหลดเวอร์ชันล่าสุดจาก plex.tv แล้วทำตามขั้นตอนของตัวติดตั้ง Plex HTPC จนเสร็จ
th.PlexInstallButton=ดาวน์โหลดและติดตั้ง Plex HTPC
th.PlexFound=พบ Plex HTPC แล้ว กด ถัดไป เพื่อติดตั้งต่อ
th.PlexMissing=ยังไม่พบ Plex HTPC
th.PlexRequired=ต้องติดตั้ง Plex HTPC ก่อนจึงจะไปต่อได้
th.PlexDownloading=กำลังดาวน์โหลด Plex HTPC…
th.WebView2Downloading=กำลังดาวน์โหลด Microsoft Edge WebView2 Runtime…
th.DownloadFailed=ดาวน์โหลดไม่สำเร็จ:%n%1
th.StartWithWindows=เปิด X Launcher อัตโนมัติเมื่อเข้าสู่ Windows
th.StartupGroup=การเริ่มทำงาน:
en.PlexPageTitle=Plex HTPC is required
en.PlexPageSubtitle=X Launcher plays your movies and shows with Plex HTPC
en.PlexPageText=Plex HTPC was not found on this PC. It must be installed before X Launcher setup can continue.%n%nClick the button below to download the latest version from plex.tv, then follow the Plex HTPC installer to the end.
en.PlexInstallButton=Download and install Plex HTPC
en.PlexFound=Plex HTPC is installed. Click Next to continue.
en.PlexMissing=Plex HTPC is not installed yet
en.PlexRequired=Please install Plex HTPC before continuing.
en.PlexDownloading=Downloading Plex HTPC…
en.WebView2Downloading=Downloading Microsoft Edge WebView2 Runtime…
en.DownloadFailed=Download failed:%n%1
en.StartWithWindows=Start X Launcher when I sign in to Windows
en.StartupGroup=Startup:

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "startup"; Description: "{cm:StartWithWindows}"; GroupDescription: "{cm:StartupGroup}"

[Files]
Source: "{#AppSource}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon
Name: "{userstartup}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: startup

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
var
  PlexPage: TWizardPage;
  PlexStatus: TNewStaticText;
  PlexButton: TNewButton;
  DownloadPage: TDownloadWizardPage;

function UninstallKeyHasName(Root: Integer; const Key, Name: String): Boolean;
var
  Names: TArrayOfString;
  I: Integer;
  Display: String;
begin
  Result := False;
  if not RegGetSubkeyNames(Root, Key, Names) then Exit;
  for I := 0 to GetArrayLength(Names) - 1 do
    if RegQueryStringValue(Root, Key + '\' + Names[I], 'DisplayName', Display) and (CompareText(Display, Name) = 0) then
    begin
      Result := True;
      Exit;
    end;
end;

function IsPlexHtpcInstalled: Boolean;
var
  Key: String;
begin
  Key := 'Software\Microsoft\Windows\CurrentVersion\Uninstall';
  Result := FileExists(ExpandConstant('{commonpf64}\Plex\Plex HTPC\Plex HTPC.exe'))
    or FileExists(ExpandConstant('{localappdata}\Programs\Plex HTPC\Plex HTPC.exe'))
    or UninstallKeyHasName(HKLM64, Key, 'Plex HTPC')
    or UninstallKeyHasName(HKLM32, Key, 'Plex HTPC')
    or UninstallKeyHasName(HKCU, Key, 'Plex HTPC');
end;

function IsWebView2Installed: Boolean;
var
  Version: String;
  Key: String;
begin
  Key := 'Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  Result := (RegQueryStringValue(HKLM32, 'SOFTWARE\' + Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'))
    or (RegQueryStringValue(HKCU, 'Software\' + Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
end;

{ Reads the current Windows installer URL from Plex's public download API, e.g. ...-x86_64.exe }
function PlexHtpcUrl: String;
var
  Json: AnsiString;
  Text: String;
  EndPos, StartPos: Integer;
begin
  Result := '{#PlexHtpcFallback}';
  try
    DownloadTemporaryFile('{#PlexHtpcApi}', 'plex-htpc.json', '', nil);
    if not LoadStringFromFile(ExpandConstant('{tmp}\plex-htpc.json'), Json) then Exit;
    Text := String(Json);
    EndPos := Pos('-x86_64.exe', Text);
    if EndPos = 0 then Exit;
    StartPos := EndPos;
    while (StartPos > 1) and (Copy(Text, StartPos, 8) <> 'https://') do
      StartPos := StartPos - 1;
    if Copy(Text, StartPos, 31) = 'https://downloads.plex.tv/htpc/' then
      Result := Copy(Text, StartPos, EndPos + Length('-x86_64.exe') - StartPos);
  except
    Log('Plex download API unavailable, using the fallback URL: ' + GetExceptionMessage);
  end;
end;

function Download(const Url, FileName, Caption: String): Boolean;
begin
  Result := False;
  DownloadPage.Clear;
  DownloadPage.Add(Url, FileName, '');
  DownloadPage.SetText(Caption, '');
  DownloadPage.Show;
  try
    try
      DownloadPage.Download;
      Result := True;
    except
      if not DownloadPage.AbortedByUser then
        MsgBox(FmtMessage(CustomMessage('DownloadFailed'), [GetExceptionMessage]), mbError, MB_OK);
    end;
  finally
    DownloadPage.Hide;
  end;
end;

procedure UpdatePlexStatus;
begin
  if IsPlexHtpcInstalled then
  begin
    PlexStatus.Caption := CustomMessage('PlexFound');
    PlexButton.Enabled := False;
  end
  else
  begin
    PlexStatus.Caption := CustomMessage('PlexMissing');
    PlexButton.Enabled := True;
  end;
end;

procedure PlexButtonClick(Sender: TObject);
var
  ResultCode: Integer;
begin
  PlexButton.Enabled := False;
  if Download(PlexHtpcUrl, 'PlexHTPC-Setup.exe', CustomMessage('PlexDownloading')) then
    { ShellExec so the Plex installer can ask for administrator rights itself }
    ShellExec('', ExpandConstant('{tmp}\PlexHTPC-Setup.exe'), '', '', SW_SHOWNORMAL, ewWaitUntilTerminated, ResultCode);
  UpdatePlexStatus;
end;

procedure InitializeWizard;
var
  Intro: TNewStaticText;
begin
  DownloadPage := CreateDownloadPage(SetupMessage(msgWizardPreparing), SetupMessage(msgPreparingDesc), nil);

  PlexPage := CreateCustomPage(wpSelectTasks, CustomMessage('PlexPageTitle'), CustomMessage('PlexPageSubtitle'));
  Intro := TNewStaticText.Create(PlexPage);
  Intro.Parent := PlexPage.Surface;
  Intro.WordWrap := True;
  Intro.Width := PlexPage.SurfaceWidth;
  Intro.Caption := CustomMessage('PlexPageText');

  PlexButton := TNewButton.Create(PlexPage);
  PlexButton.Parent := PlexPage.Surface;
  PlexButton.Top := Intro.Top + Intro.Height + ScaleY(20);
  PlexButton.Width := ScaleX(280);
  PlexButton.Height := ScaleY(30);
  PlexButton.Caption := CustomMessage('PlexInstallButton');
  PlexButton.OnClick := @PlexButtonClick;

  PlexStatus := TNewStaticText.Create(PlexPage);
  PlexStatus.Parent := PlexPage.Surface;
  PlexStatus.Top := PlexButton.Top + PlexButton.Height + ScaleY(14);
  PlexStatus.Font.Style := [fsBold];
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  { Skip the Plex page when Plex HTPC is already there }
  Result := (PageID = PlexPage.ID) and IsPlexHtpcInstalled;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = PlexPage.ID then UpdatePlexStatus;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if (CurPageID = PlexPage.ID) and not IsPlexHtpcInstalled then
  begin
    MsgBox(CustomMessage('PlexRequired'), mbError, MB_OK);
    Result := False;
  end
  else if (CurPageID = wpReady) and not IsWebView2Installed then
  begin
    { Built into Windows 11; older systems get Microsoft's evergreen bootstrapper }
    if Download('{#WebView2Bootstrapper}', 'MicrosoftEdgeWebview2Setup.exe', CustomMessage('WebView2Downloading')) then
      ShellExec('', ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'), '/silent /install', '', SW_SHOWNORMAL, ewWaitUntilTerminated, ResultCode);
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  { Silent installs never see the Plex page, so check again before copying files }
  if not IsPlexHtpcInstalled then
    Result := CustomMessage('PlexRequired')
  else
    Result := '';
end;
