; Project Tracker installer: maintenance page shown when the program is already installed.
; Copyright (c) 2026 Yasser Mohamed Abdelgaber. All rights reserved.
; Project data lives in Documents\Project Tracker and is never touched by any option here.

!include nsDialogs.nsh
!include LogicLib.nsh

!macro customWelcomePage
  Var ptDialog
  Var ptRepair
  Var ptReinstall
  Var ptRemove
  Var ptOldDir
  Var ptOldCtx

  Page custom ptMaintenanceShow ptMaintenanceLeave

  Function ptFindOld
    StrCpy $ptOldDir ""
    StrCpy $ptOldCtx "/currentuser"
    ReadRegStr $ptOldDir HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${If} $ptOldDir == ""
      ReadRegStr $ptOldDir HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
      StrCpy $ptOldCtx "/allusers"
    ${EndIf}
    ${If} $ptOldDir != ""
    ${AndIfNot} ${FileExists} "$ptOldDir\*.*"
      StrCpy $ptOldDir ""
    ${EndIf}
  FunctionEnd

  Function ptMaintenanceShow
    Call ptFindOld
    ${If} $ptOldDir == ""
      Abort
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "البرنامج مثبت على هذا الجهاز" "اختر الإجراء المطلوب"
    nsDialogs::Create 1018
    Pop $ptDialog
    ${If} $ptDialog == error
      Abort
    ${EndIf}
    ${NSD_CreateLabel} 0 0 100% 20u "يوجد إصدار مثبت من Project Tracker في:$\r$\n$ptOldDir"
    Pop $0
    ${NSD_CreateRadioButton} 0 26u 100% 12u "إصلاح البرنامج"
    Pop $ptRepair
    ${NSD_CreateLabel} 14u 38u 95% 10u "يثبّت هذا الإصدار فوق الإصدار الحالي ويستبدل ملفات البرنامج."
    Pop $0
    ${NSD_CreateRadioButton} 0 54u 100% 12u "إعادة التثبيت بالكامل"
    Pop $ptReinstall
    ${NSD_CreateLabel} 14u 66u 95% 10u "يحذف مجلد البرنامج كاملاً ثم يثبّته من جديد."
    Pop $0
    ${NSD_CreateRadioButton} 0 82u 100% 12u "إزالة البرنامج"
    Pop $ptRemove
    ${NSD_CreateLabel} 14u 94u 95% 10u "يزيل البرنامج من الجهاز دون تثبيت."
    Pop $0
    ${NSD_CreateLabel} 0 112u 100% 26u "في جميع الاختيارات تبقى بيانات مشاريعك ونسخها الاحتياطية كما هي في مجلد: المستندات\Project Tracker"
    Pop $0
    ${NSD_Check} $ptRepair
    nsDialogs::Show
  FunctionEnd

  Function ptRemoveOld
    ${If} ${FileExists} "$ptOldDir\${UNINSTALL_FILENAME}"
      ExecWait '"$ptOldDir\${UNINSTALL_FILENAME}" /S /KEEP_APP_DATA $ptOldCtx _?=$ptOldDir'
    ${EndIf}
    RMDir /r "$ptOldDir"
  FunctionEnd

  Function ptMaintenanceLeave
    ${NSD_GetState} $ptRemove $0
    ${If} $0 == ${BST_CHECKED}
      MessageBox MB_YESNO|MB_ICONQUESTION "إزالة Project Tracker من هذا الجهاز؟$\r$\nبيانات مشاريعك لن تُحذف." IDYES +2
      Abort
      Call ptRemoveOld
      MessageBox MB_OK|MB_ICONINFORMATION "تمت إزالة البرنامج.$\r$\nبيانات مشاريعك محفوظة في: المستندات\Project Tracker"
      Quit
    ${EndIf}
    ${NSD_GetState} $ptReinstall $0
    ${If} $0 == ${BST_CHECKED}
      Call ptRemoveOld
    ${EndIf}
  FunctionEnd
!macroend
