Attribute VB_Name = "l_IIDAILYREPORT"
'what should we do to form a template for manpower report
'We distribute the activities by different scopes, form a list of activity ID
'We build the WBS for these IDs, grouping, splitting them to make it easy for understanding
'We upload the relevant data matching IDs.
'We automate the email process and distribute the emails to the responsible subcontractors.
'We gather the filled table and upload the data to the system.
'We update P6 by importing excel template.

Public ovrList, vlist, scope, tt


Sub Main_DailyReportProcedure()
MPREPORT_CREATE_II
PVREPORT_CREATE_II
sendMP
sendVFACT
sendschedule
End Sub

Sub Main_WeekyReportProcedure()

sendATT2
sendATT3


End Sub


Sub MPREPORT_CREATE_II()
tt = Timer
Dim fpath As String, fname As Variant
Dim i As Integer, j As Integer, t As Integer
Dim wb As Workbook, sh As Worksheet, sht As Worksheet
Dim arr As Variant
Dim fso As Scripting.FileSystemObject, fd As Folder, fd1 As Folder, fl As File
Dim dd As Date

'prepare
Application.ScreenUpdating = False
Application.Calculation = xlCalculationManual
Application.EnableEvents = False
dd = Date + 1

'create folder *date
Set fso = New Scripting.FileSystemObject
'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\MP\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\MP\"
Set fd = fso.GetFolder(fpath)
For Each fd1 In fd.SubFolders
    If fd1.Name = Format(dd, "YYYYMMDD") Then
        t = t + 1
    End If
Next
If t = 0 Then
    VBA.MkDir (fpath & Format(dd, "YYYYMMDD"))
End If

Set fd = Nothing
Set fd = fso.GetFolder(fpath & Format(dd, "YYYYMMDD"))

' create new workbook using template format
arr = Sheets("FILENAME").Range("a1").CurrentRegion.Value
If fd.Files.Count = 0 Then
    For i = 2 To UBound(arr, 1)
'        Workbooks.Open ("C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\" & "TEMP.xlsb")
        Workbooks.Open ("C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\" & "TEMP.xlsb")
        Set wb = Workbooks("TEMP.xlsb")
        With wb.Worksheets("TEMP PMS_MP")
            .Unprotect "cc7" 'unprotect first
            .Name = "MP-" & Format(dd, "YYYYMMDD")
        End With
        With wb
            .SaveCopyAs Filename:=fpath & Format(dd, "YYYYMMDD") & "\" & arr(i, 8) & ".xlsb"
            .Close False
        End With
        Set wb = Nothing
    Next i
End If

CreateOvrList
CreateMPTemp

'end
Application.ScreenUpdating = True
Application.Calculation = xlCalculationAutomatic
Application.EnableEvents = True

'ElapsedTime = Timer - tt
'MsgBox "Manpower Report Template Creation Has Been Completed, Elapsed Time: " & Format(ElapsedTime \ 60, "00") & ":" & Format(ElapsedTime Mod 60, "00") & "."
End Sub



Sub PVREPORT_CREATE_II()

Dim fpath As String, fname As Variant
Dim i As Integer, j As Integer, t As Integer
Dim wb As Workbook, sh As Worksheet, sht As Worksheet
Dim arr As Variant
Dim fso As Scripting.FileSystemObject, fd As Folder, fd1 As Folder, fl As File
Dim dd As Date

With Sheets("EXCEPTION LIST")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    If irow > 1 Then
        .Range("a2:k" & irow).Clear
    End If
End With


'prepare
Application.ScreenUpdating = False
Application.Calculation = xlCalculationManual
Application.EnableEvents = False
dd = Date

'create folder *date
Set fso = New Scripting.FileSystemObject
'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\VFACT\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\VFACT\"
Set fd = fso.GetFolder(fpath)
For Each fd1 In fd.SubFolders
    If fd1.Name = Format(dd, "YYYYMMDD") Then
        t = t + 1
    End If
Next
If t = 0 Then
    VBA.MkDir (fpath & Format(dd, "YYYYMMDD"))
End If

Set fd = Nothing
Set fd = fso.GetFolder(fpath & Format(dd, "YYYYMMDD"))

' create new workbook using template format
arr = Sheets("FILENAME").Range("a1").CurrentRegion.Value
If fd.Files.Count = 0 Then
    For i = 2 To UBound(arr, 1)
        'Workbooks.Open ("C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\" & "TEMP_PV.xlsb")
        Workbooks.Open ("C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\" & "TEMP_PV.xlsb")
        Set wb = Workbooks("TEMP_PV.xlsb")
        With wb.Worksheets("TEMP PMS_PV")
            .Unprotect "cc7" 'unprotect first
            .Name = "VFACT-" & Format(dd, "YYYYMMDD")
        End With
        With wb
            .SaveCopyAs Filename:=fpath & Format(dd, "YYYYMMDD") & "\" & arr(i, 9) & ".xlsb"
            .Close False
        End With
        Set wb = Nothing
    Next i
End If

CreateOvrList
prepareList_VFACT

ecpList = Sheets("EXCEPTION LIST").Range("a1").CurrentRegion.Value
Set newwb = Workbooks.Add
Set newsh = newwb.Sheets(1)
With newsh
    .Range("a1").Resize(UBound(ecpList, 1), UBound(ecpList, 2)) = ecpList
End With
'savePath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\EXCEPTION\" & "EXCEPTION LIST_" & Format(Date, "YYYYMMDD") & ".xlsx"
savePath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\EXCEPTION\" & "EXCEPTION LIST_" & Format(dd, "YYYYMMDD") & ".xlsx"
newwb.SaveAs savePath
newwb.Close False

Application.ScreenUpdating = True
Application.Calculation = xlCalculationAutomatic
Application.EnableEvents = True
ElaspedTime = Timer - tt

'MsgBox "Physical Report Template Creation Has Been Completed, Elapsed Time: " & Format(ElaspedTime \ 60, "00") & ":" & Format(ElaspedTime Mod 60, "00") & "."

End Sub


