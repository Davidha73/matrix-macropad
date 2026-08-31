Set WshShell = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c ""cd /d """ & dir & """ && call start_win.bat""", 0, False
