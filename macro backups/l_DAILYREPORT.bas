Attribute VB_Name = "l_DAILYREPORT"
'what should we do to form a template for manpower report
'We distribute the activities by different scopes, form a list of activity ID
'We build the WBS for these IDs, grouping, splitting them to make it easy for understanding
'We upload the relevant data matching IDs.
'We automate the email process and distribute the emails to the responsible subcontractors.
'We gather the filled table and upload the data to the system.
'We update P6 by importing excel template.

Public ovrList, vlist, scope

Sub MPREPORT_CREATE()
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
ElapsedTime = Timer - tt
MsgBox "Manpower Report Template Creation Has Been Completed, Elapsed Time: " & Format(ElapsedTime \ 60, "00") & ":" & Format(ElapsedTime Mod 60, "00") & "."
End Sub



Sub CreateOvrList()

Dim clist, plist, elist, cPkg, pPkg, ePkg
Dim vdata, result, arr, brr, crr, k, t
'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\MP\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\MP\"

With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    clist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With
ReDim vdata(1 To UBound(clist, 2), 1 To 1)
Set d = CreateObject("scripting.dictionary")
ReDim brr(1 To UBound(clist, 2))
For i = LBound(clist, 1) To UBound(clist, 1)
    If clist(i, 14) <> "" Then
        tempstr = clist(i, 14)
        If Not d.Exists(tempstr) Then
            ReDim brr(1 To UBound(clist, 2))
        Else
            brr = d(tempstr)
        End If
        For j = LBound(brr) To UBound(brr)
            brr(j) = brr(j) & "@" & clist(i, j)
        Next
        d(tempstr) = brr
    End If
Next

scope = d.Keys
t = d.Items

For i = LBound(t) To UBound(t)
    For j = LBound(t(i)) To UBound(t(i))
        Dim tempArray As Variant
        tempArray = Split(Right(t(i)(j), Len(t(i)(j)) - 1), "@")
        t(i)(j) = tempArray
        If UBound(t(i)(j)) < 0 Then
            t(i)(j) = Array(0)
        End If
    Next
Next
'With Sheets("Activity List (P)")
'    irow = .Cells(Rows.Count, 3).End(xlUp).Row
'    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
'    plist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
'End With
'
'With Sheets("Activity List (E)")
'    irow = .Cells(Rows.Count, 3).End(xlUp).Row
'    icol = 31
'    elist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
'End With

'With Sheets("WorkSteps_C")
'    irow = .Cells(Rows.Count, 1).End(xlUp).Row
'    icol = .Cells(3, Columns.Count).End(xlToLeft).Column
'    cPkg = .Range(.Cells(4, 1), .Cells(irow, icol)).Value
'End With

'clist

'For i = LBound(elist, 1) To UBound(elist, 1)
'    If elist(i, 31) = "Y" And elist(i, 16) <> "" Then
'        cnt = cnt + 1
'        ReDim Preserve vdata(1 To UBound(elist, 2), 1 To cnt)
'        For j = LBound(elist, 2) To UBound(elist, 2)
'            vdata(j, cnt) = elist(i, j)
'        Next
'    End If
'Next
'For i = LBound(plist, 1) To UBound(plist, 1)
'    If plist(i, 31) = "Y" And plist(i, 16) <> "" Then
'        cnt = cnt + 1
'        ReDim Preserve vdata(1 To UBound(plist, 2), 1 To cnt)
'        For j = LBound(plist, 2) To UBound(plist, 2)
'            vdata(j, cnt) = plist(i, j)
'        Next
'    End If
'Next
'For i = LBound(clist, 1) To UBound(clist, 1)
'    If clist(i, 35) = "Y" And clist(i, 14) <> "" Then
'        cnt = cnt + 1
'        ReDim Preserve vdata(1 To UBound(clist, 2), 1 To cnt)
'        For j = LBound(clist, 2) To UBound(clist, 2)
'            vdata(j, cnt) = clist(i, j)
'        Next
'    End If
'Next
'ReDim temp(1 To UBound(vdata, 2), 1 To UBound(vdata, 1))
'For i = LBound(vdata, 2) To UBound(vdata, 2)
'    For j = LBound(vdata, 1) To UBound(vdata, 1)
'        temp(i, j) = vdata(j, i)
'    Next
'Next
'ovrList = temp
ovrList = t

End Sub

Sub CreateMPTemp()
Dim DSTR, processList
cnt = 0
DSTR = Sheets("FILENAME").Range("a1").CurrentRegion.Value

For p = 2 To UBound(DSTR, 1)
    For j = LBound(scope) To UBound(scope)
        If DSTR(p, 1) = scope(j) Then
            processList = ovrList(j)(2)
            cnt = 0
            If UBound(processList, 1) = 0 And processList(0) = Empty Then
            Else
                result = BuildReportStructure(processList, j)
                result = StructureInfoMatching(result, j)
                'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\MP\"
                fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\MP\"
                dd = Date + 1
                Set wb = Workbooks.Open(fpath & Format(dd, "YYYYMMDD") & "\" & DSTR(p, 8) & ".xlsb")
                With wb.Sheets(DSTR(p, 4) & "-" & Format(DSTR(p, 6) + 1, "YYYYMMDD"))
                    .Range("a13").Resize(UBound(result, 1), UBound(result, 2)) = result
                End With
                formatEndMP p, wb.Name
            End If
        End If
    Next
Next
End Sub

Function StructureInfoMatching(ByVal structedIDs As Variant, ByVal idx As Integer)
RELWBS = Array(3, 5, 7, 9, 11, 13, 15)

WBSTable = Sheets("WBS Table").Range("a3:p" & Sheets("WBS Table").Cells(Rows.Count, 11).End(xlUp).Row)
ReDim vdata(1 To UBound(structedIDs, 1), 1 To 18)
For i = LBound(structedIDs, 1) To UBound(structedIDs, 1)
    blk = UBound(Split(structedIDs(i, 1), "/"))
    tempstr = Split(structedIDs(i, 1), "/")(UBound(Split(structedIDs(i, 1), "/")))
    If blk = 6 Then
        'tempstr = Split(structedIDs(i, 1), "/")(3) & Split(structedIDs(i, 1), "/")(1) & Split(Split(structedIDs(i, 1), "/")(4), "-")(1) & Split(Split(structedIDs(i, 1), "/")(4), "-")(2) & Split(structedIDs(i, 1), "/")(5) & Split(structedIDs(i, 1), "/")(6)
        For j = LBound(ovrList(idx)(1)) To UBound(ovrList(idx)(1))
            If ovrList(idx)(8)(j) = Split(structedIDs(i, 1), "/")(4) And ovrList(idx)(13)(j) = Split(structedIDs(i, 1), "/")(5) Then
                If Len(ovrList(idx)(2)(j)) = 20 And Right(ovrList(idx)(2)(j), 4) = Split(structedIDs(i, 1), "/")(6) Then
                    For m = 1 To 8
                        vdata(i, m) = ovrList(idx)(m)(j)
                    Next
                    vdata(i, 9) = ovrList(idx)(11)(j)
                    vdata(i, 10) = ovrList(idx)(12)(j)
                    vdata(i, 11) = ovrList(idx)(13)(j)
                    vdata(i, 12) = 8
                    vdata(i, 13) = ovrList(idx)(26)(j)
                    vdata(i, 14) = ovrList(idx)(27)(j)
                    vdata(i, 15) = ovrList(idx)(29)(j)
                    vdata(i, 16) = ovrList(idx)(30)(j)
                    Exit For
                ElseIf Len(ovrList(idx)(2)(j)) = 19 And Right(ovrList(idx)(2)(j), 3) = Split(structedIDs(i, 1), "/")(6) Then
                    For m = 1 To 8
                        vdata(i, m) = ovrList(idx)(m)(j)
                    Next
                    vdata(i, 9) = ovrList(idx)(11)(j)
                    vdata(i, 10) = ovrList(idx)(12)(j)
                    vdata(i, 11) = ovrList(idx)(13)(j)
                    vdata(i, 12) = 8
                    vdata(i, 13) = ovrList(idx)(26)(j)
                    vdata(i, 14) = ovrList(idx)(27)(j)
                    vdata(i, 15) = ovrList(idx)(29)(j)
                    vdata(i, 16) = ovrList(idx)(30)(j)
                    Exit For
                End If
                
            End If
        Next
    Else
        If blk = 5 And Len(Split(structedIDs(i, 1), "/")(UBound(Split(structedIDs(i, 1), "/")))) >= 4 Then
            blk = blk + 1
        End If
        For j = LBound(WBSTable, 1) To UBound(WBSTable, 1)
            If blk = 0 Then
                If tempstr = "GE" Then
                    vdata(i, 9) = "Interface"
                    vdata(i, 12) = blk + 1
                    Exit For
                ElseIf tempstr = "EX" Then
                    vdata(i, 9) = "Temporary Facilities"
                    vdata(i, 12) = blk + 1
                    Exit For
                ElseIf tempstr = "UI" Then
                    vdata(i, 9) = "Interconnecting Unit"
                    vdata(i, 12) = blk + 1
                    Exit For
                ElseIf tempstr = "PE" Or tempstr = "PW" Or tempstr = "HE" Or tempstr = "BU" Then
                    vdata(i, 9) = "PE/LAO"
                    vdata(i, 12) = blk + 1
                    Exit For
                ElseIf tempstr = "EC" Then
                    vdata(i, 9) = "Ethane Cracking Unit"
                    vdata(i, 12) = blk + 1
                    Exit For
                End If
            Else
            
                If tempstr = WBSTable(j, RELWBS(blk)) Then
                    vdata(i, 9) = WBSTable(j, RELWBS(blk) + 1)
                    vdata(i, 12) = blk + 1
                    Exit For
                End If
            End If
        Next
    End If
Next
StructureInfoMatching = vdata
End Function

Function BuildReportStructure(ByVal IDs As Variant, ByVal idx As Variant)

'group ID by Project, Subproject, Phase, Train, Unit, Block, Discipline, WorkPackage
'If the IDs belong to the some work Package, they should be put together

'algorithm:
'Form an Activity Pool: Block+Discipline+WorkPackage (Level Block, unique)

'UI1CT11000001100CI0901, UI, CT, T1, UI1, 1100, 00011, 00, CI09, 01

ReDim temp(1 To UBound(IDs) + 1, 1 To 9)
If UBound(ovrList(idx)(1)) = UBound(temp, 1) - 1 Then
    For i = LBound(temp, 1) To UBound(temp, 1)
        temp(i, 1) = Left(ovrList(idx)(7)(i - 1), 2)
        temp(i, 2) = ovrList(idx)(5)(i - 1)
        temp(i, 3) = ovrList(idx)(6)(i - 1)
        temp(i, 4) = ovrList(idx)(7)(i - 1)
        temp(i, 5) = Left(ovrList(idx)(8)(i - 1), 4)
        temp(i, 6) = Mid(ovrList(idx)(8)(i - 1), 6, 5)
        temp(i, 7) = Right(ovrList(idx)(8)(i - 1), 2)
        temp(i, 8) = ovrList(idx)(13)(i - 1)
        If Len(IDs(i - 1)) = 20 Then
            temp(i, 9) = Right(IDs(i - 1), 4)
        Else
            temp(i, 9) = Right(IDs(i - 1), 3)
        End If
    Next
Else
    For i = LBound(temp, 1) To UBound(temp, 1)
        For j = LBound(ovrList(idx)(14)) To UBound(ovrList(idx)(14))
            If IDs(i - 1) = ovrList(idx)(2)(j) Then
                temp(i, 1) = Left(ovrList(idx)(7)(j), 2)
                temp(i, 2) = ovrList(idx)(5)(j)
                temp(i, 3) = ovrList(idx)(6)(j)
                temp(i, 4) = ovrList(idx)(7)(j)
                temp(i, 5) = Left(ovrList(idx)(8)(j), 4)
                temp(i, 6) = Mid(ovrList(idx)(8)(j), 6, 5)
                temp(i, 7) = Right(ovrList(idx)(8)(j), 2)
                temp(i, 8) = ovrList(idx)(13)(j)
                If Len(IDs(i - 1)) = 20 Then
                    temp(i, 9) = Right(IDs(i - 1), 4)
                Else
                    temp(i, 9) = Right(IDs(i - 1), 3)
                End If
            End If
        Next
    Next
End If
    

Set d = CreateObject("scripting.dictionary")
For i = LBound(temp, 1) To UBound(temp, 1)
    tempstr = temp(i, 1) & "/" & temp(i, 2) & "/" & temp(i, 3) & "/" & temp(i, 4) & "/" & temp(i, 5) & "-" & temp(i, 6) & "-" & temp(i, 7)
    If Not d.Exists(tempstr) Then
        ReDim brr(1 To 2)
    Else
        brr = d(tempstr)
    End If
    If IsEmpty(brr(1)) Then
        brr(1) = temp(i, 8)
    Else
        brr(1) = brr(1) & "/" & temp(i, 8)
    End If
    If IsEmpty(brr(2)) Then
        brr(2) = temp(i, 9)
    Else
        brr(2) = brr(2) & "/" & temp(i, 9)
    End If
    d(tempstr) = brr
Next
k = d.Keys
t = d.Items

WBSTable = Sheets("WBS Table").Range("a3:p" & Sheets("WBS Table").Cells(Rows.Count, 11).End(xlUp).Row)

ReDim seqrng(1 To UBound(k) + 1, 1 To 3)
cnt = 0
For i = LBound(WBSTable, 1) To UBound(WBSTable, 1)
    For j = LBound(k) To UBound(k)
        If WBSTable(i, 9) = Mid(k(j), 10, 3) Then
            cnt = cnt + 1
            seqrng(cnt, 1) = k(j)
            seqrng(cnt, 2) = t(j)(1)
            seqrng(cnt, 3) = t(j)(2)
        End If
    Next
Next

ReDim arr(1 To 1, 1 To 1)
cnt = 0
For i = LBound(seqrng, 1) To UBound(seqrng, 1)
    temp1 = Split(seqrng(i, 2), "/")
    temp2 = Split(seqrng(i, 3), "/")
    For m = LBound(temp1) To UBound(temp1)
        cnt = cnt + 1
        ReDim Preserve arr(1 To 1, 1 To cnt)
        arr(1, cnt) = seqrng(i, 1) & "/" & temp1(m) & "/" & temp2(m)
    Next
Next

ReDim mins(1 To UBound(arr, 2), 1 To 7)

For i = LBound(mins, 1) To UBound(mins, 1)
    tempstr = arr(1, i)
    For j = LBound(mins, 2) To UBound(mins, 2)
        mins(i, j) = Len(arr(1, i)) - InStrRev(tempstr, "/") + 1
        If j = 1 Then
            j = j + 1
            mins(i, j) = mins(i, j - 1) + 2
        End If
        tempstr = Left(tempstr, InStrRev(tempstr, "/") - 1)
    Next
Next



'mins = Array(4, 6, 9, 23, 27, 30, 33)

ReDim temp(1 To 1, 1 To 1)
cnt = 0


If UBound(arr, 2) = 1 Then
    For j = LBound(mins, 2) To UBound(mins, 2)
        cnt = cnt + 1
        ReDim Preserve temp(1 To 1, 1 To cnt)
        For m = 1 To j
            temp(1, cnt - m + 1) = Left(arr(1, 1), Len(arr(1, 1)) - mins(1, m))
        Next

    Next
    cnt = cnt + 1
    ReDim Preserve temp(1 To 1, 1 To cnt)
    temp(1, cnt) = arr(1, 1)
Else
    For i = LBound(arr, 2) To UBound(arr, 2)
        For j = LBound(mins, 2) To UBound(mins, 2)
            If i = 1 Then
                cnt = cnt + 1
                ReDim Preserve temp(1 To 1, 1 To cnt)
                For m = 1 To j
                    temp(1, cnt - m + 1) = Left(arr(1, i), Len(arr(1, i)) - mins(i, m))
                Next
    
            Else
                
                If Left(arr(1, i), Len(arr(1, i)) - mins(i, j)) <> Left(arr(1, i - 1), Len(arr(1, i - 1)) - mins(i - 1, j)) Then
                    cnt = cnt + 1
                    ReDim Preserve temp(1 To 1, 1 To cnt)
                    For m = 1 To j
                        temp(1, cnt - m + 1) = Left(arr(1, i), Len(arr(1, i)) - mins(i, m))
                    Next

                End If
            End If
        Next
        cnt = cnt + 1
        ReDim Preserve temp(1 To 1, 1 To cnt)
        temp(1, cnt) = arr(1, i)
    Next
End If

ReDim result(1 To UBound(temp, 2), 1 To UBound(temp, 1))
For i = LBound(temp, 2) To UBound(temp, 2)
    For j = LBound(temp, 1) To UBound(temp, 1)
        result(i, j) = temp(j, i)
    Next
Next

BuildReportStructure = result
End Function

Sub formatEndMP(ByVal idx As Integer, ByVal fname As String)
ThisWorkbook.Activate
DSTR = Sheets("FILENAME").Range("a1").CurrentRegion.Value
With Sheets("format")
    fmt = .Range("a1").CurrentRegion.Value
End With
dd = Date + 1
With Workbooks(fname).Sheets(DSTR(idx, 4) & "-" & Format(dd, "YYYYMMDD"))
    irow = .Cells(Rows.Count, 9).End(xlUp).Row
    If irow > 12 Then
        vdata = .Range("a13:s" & irow)
    End If
    For i = LBound(vdata, 1) To UBound(vdata, 1)
        For j = 2 To UBound(fmt, 1)
            If vdata(i, 12) = fmt(j, 5) Then
                .Range(.Cells(i + 12, 1), .Cells(i + 12, 19)).Interior.Color = RGB(fmt(j, 2), fmt(j, 3), fmt(j, 4))
                .Range(.Cells(i + 12, 1), .Cells(i + 12, 19)).Font.Name = "Arial Narrow"
                If fmt(j, 5) = 3 Or fmt(j, 5) = 4 Then
                    .Range(.Cells(i + 12, 1), .Cells(i + 12, 19)).Font.Color = RGB(255, 255, 255)
                ElseIf fmt(j, 5) = 2 Then
                    .Range(.Cells(i + 12, 1), .Cells(i + 12, 19)).Font.Color = RGB(0, 0, 255)
                End If
                With .Range(.Cells(i + 12, 1), .Cells(i + 12, 19)).Borders
                    .LineStyle = xlContinuous
                    .Color = RGB(144, 144, 144)
                End With
                .Cells(i + 12, 9).IndentLevel = fmt(j, 5)
                Exit For
            End If
        Next
    Next
    .Range("q8").Value = "=SUM(Q13:Q1000000)+SUM(Q2:Q7)"
    .Range("R8").Value = "=SUM(R13:R1000000)+SUM(R2:R7)"
    .Range("b7").Value = DSTR(idx, 1)
    .Range("r1").Value = "DATE OF REPORT " & Format(Date, "DD.MM.YYYY") & " " & Format(Time, "hh:mm:ss")
    .Range("O2").Value = "Management Personnel"
    .Range("O3").Value = "Technical Personnel"
    .Range("O4").Value = "HSE"
    .Range("O5").Value = "Logistic"
    .Range("O6").Value = "Day-off(indirect)"
    .Range("O7").Value = "Day-off(direct)"
    .Range("o2:r8").Font.Name = "Arial Narrow"
    With .Range("q2:r8")
        .Locked = False
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(144, 144, 144)
    End With
End With
groupLevels fname
Workbooks(fname).Close True
End Sub

Sub formatEndPV(ByVal idx As Integer, ByVal fname As String)
ThisWorkbook.Activate
DSTR = Sheets("FILENAME").Range("a1").CurrentRegion.Value
With Sheets("format")
    fmt = .Range("a1").CurrentRegion.Value
End With
With Workbooks(fname).Sheets(DSTR(idx, 5) & "-" & Format(DSTR(idx, 6), "YYYYMMDD"))
    irow = .Cells(Rows.Count, 9).End(xlUp).Row
    If irow > 12 Then
        vdata = .Range("a13:w" & irow)
    End If
    For i = LBound(vdata, 1) To UBound(vdata, 1)
        For j = 2 To UBound(fmt, 1)
            If vdata(i, 12) = fmt(j, 5) Then
                .Range(.Cells(i + 12, 1), .Cells(i + 12, 23)).Interior.Color = RGB(fmt(j, 2), fmt(j, 3), fmt(j, 4))
                .Range(.Cells(i + 12, 1), .Cells(i + 12, 23)).Font.Name = "Arial Narrow"
                If fmt(j, 5) = 3 Or fmt(j, 5) = 4 Then
                    .Range(.Cells(i + 12, 1), .Cells(i + 12, 23)).Font.Color = RGB(255, 255, 255)
                ElseIf fmt(j, 5) = 2 Then
                    .Range(.Cells(i + 12, 1), .Cells(i + 12, 23)).Font.Color = RGB(0, 0, 255)
                ElseIf fmt(j, 5) = 9 And Left(vdata(i, 9), 4) = "ERR:" Then
                    .Range(.Cells(i + 12, 1), .Cells(i + 12, 23)).Font.Color = RGB(255, 0, 0)
                    .Cells(i + 12, 23).Interior.Color = RGB(128, 128, 128)
                ElseIf fmt(j, 5) = 9 Then
                    .Cells(i + 12, 23).Interior.Color = RGB(224, 224, 224)
                    .Cells(i + 12, 23).Font.Color = RGB(0, 0, 0)
                End If
                With .Range(.Cells(i + 12, 1), .Cells(i + 12, 23)).Borders
                    .LineStyle = xlContinuous
                    .Color = RGB(144, 144, 144)
                End With
                .Cells(i + 12, 9).IndentLevel = fmt(j, 5)
                Exit For
            End If
            
        Next
    Next
    .Range("b7").Value = DSTR(idx, 1)
    '.Range("r1").Value = "DATE OF REPORT " & Format(Date, "DD.MM.YYYY") & " " & Format(Time, "hh:mm:ss")
End With
groupLevels fname
Workbooks(fname).Close True
End Sub


Sub groupLevels(ByVal wbname As String)

Dim i As Long, j As Long, k As Long, m As Long, m1 As Long
Dim arr As Variant
Dim s As Variant
Dim wb As Workbook
Dim lastRow As Integer
Dim fso As Scripting.FileSystemObject
Dim fpath As String, fl As File, fd As Folder

    
Set wb = Workbooks(wbname)
With wb.Sheets(1)
    If Left(.Name, 2) = "MP" Then
        ReDim s(1 To 7)
    Else
        ReDim s(2 To 8)
    End If
    irow = .Cells(Rows.Count, 9).End(xlUp).Row
    arr = .Range(.Cells(13, 1), .Cells(irow, 19)).Value
    If .Rows(13 & ":" & UBound(arr, 1) + 12).Group = True Then
        .Rows(13 & ":" & UBound(arr, 1) + 12).ClearOutline
    End If
    lastRow = UBound(arr, 1) + 1
    For i = LBound(arr, 1) To UBound(arr, 1)
        For j = LBound(s) To UBound(s)
            If arr(i, 12) = j Then
                s(j) = s(j) & "-" & i
            End If
        Next
    Next
    
    For i = LBound(s) To UBound(s)
        s(i) = s(i) & "-" & lastRow
        s(i) = Split(s(i), "-")
    Next i
    
    m = 0
    For i = LBound(s) To UBound(s)
        For j = LBound(s(i)) To UBound(s(i)) - 1
            If i = 1 Then
                If s(i)(j) <> "" Then
                    .Rows(s(i)(j) + 1 + 12 & ":" & s(i)(j + 1) - 1 + 12).Group
                    .Outline.SummaryRow = xlAbove
                End If
            ElseIf i > 1 Then
                If s(i)(j) <> "" Then
                    For k = s(i)(j) + 1 To s(i)(j + 1)
                        If s(i)(j + 1) < lastRow Then
                            If arr(k, 12) <= i Then
                                m = k
                                Exit For
                            End If

                        End If
                    Next k


                    If m > 0 Then
                        'If s(i)(j) + 1 + 12 - (m - 1 + 12) > 0 Then
                             .Rows(s(i)(j) + 1 + 12 & ":" & m - 1 + 12).Group
                             .Outline.SummaryRow = xlAbove
                        'End If
                    ElseIf m = 0 Then
                        'If s(i)(j) + 1 + 12 - (s(i)(j + 1) - 1 + 12) > 0 Then
                            .Rows(s(i)(j) + 1 + 12 & ":" & s(i)(j + 1) - 1 + 12).Group
                        'End If
                    .Outline.SummaryRow = xlAbove
                    End If
                    m = 0

                End If
            End If

        Next j
    Next i
    .Columns("C:H").Group (True)
    .Columns("J:N").Group (True)
    .Columns("C:H").EntireColumn.Hidden = True
    .Columns("J:N").EntireColumn.Hidden = True
    If .Name = "MP-" & Format(Date + 1, "YYYYMMDD") Then
        For i = LBound(arr, 1) To UBound(arr, 1)
            If arr(i, 12) = 8 Then
                .Range("q" & i + 12 & ":s" & i + 12).Locked = False
            End If
        Next i
    ElseIf .Name = "VFACT-" & Format(Date, "YYYYMMDD") Then
        For i = LBound(arr, 1) To UBound(arr, 1)
            If arr(i, 12) = 9 And .Range("w" & i + 12).Interior.Color = RGB(224, 224, 224) Then
                .Range("w" & i + 12).Locked = False
            End If
        Next i
    End If
End With

End Sub
Sub PVREPORT_CREATE()

tt = Timer
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
savePath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\EXCEPTION\" & "EXCEPTION LIST_" & Format(Date, "YYYYMMDD") & ".xlsx"
newwb.SaveAs savePath
newwb.Close False

Application.ScreenUpdating = True
Application.Calculation = xlCalculationAutomatic
Application.EnableEvents = True
ElaspedTime = Timer - tt

MsgBox "Physical Report Template Creation Has Been Completed, Elapsed Time: " & Format(ElaspedTime \ 60, "00") & ":" & Format(ElaspedTime Mod 60, "00") & "."

End Sub

Sub prepareList_VFACT()

Dim fso As Scripting.FileSystemObject, fd, fd1, fl
Dim i As Integer, j As Integer
Dim wb As Workbook, sh As Worksheet
Dim fpath As String
Dim oPV As ProtectedViewWindow
Dim arr As Variant, s As Integer, brr As Variant, crr As Variant
Dim irow As Integer, uid As Variant, k As Long, h As Long

dd = Date

'get activties from MP
'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\RECEIVE\MP"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\RECEIVE\MP"
ReDim brr(1 To 5, 1 To 1)
Set fso = New Scripting.FileSystemObject
Set fd = fso.GetFolder(fpath)
For Each fd1 In fd.SubFolders
    If fd1.Name = Format(dd, "YYYYMMDD") Then
        For Each fl In fd1.Files
            Workbooks.Open fl.Path, False
            Set wb = Workbooks(fl.Name)
            wb.Activate
            Set oPV = Excel.Application.ActiveProtectedViewWindow
            If oPV Is Nothing Then
            
            Else
                With oPV
                    Set wb = .Edit
                End With
            End If
            Set oPV = Nothing
            
            Set sh = wb.Worksheets("MP-" & Format(dd, "YYYYMMDD"))
            With sh
                .Unprotect "cc7"
                .Outline.ShowLevels RowLevels:=8
                If .FilterMode = True And .AutoFilterMode = True Then
                    .ShowAllData
                End If
                irow = .Cells(Rows.Count, 2).End(xlUp).Row
                If irow < 13 Then
                    wb.Close False
                    GoTo nextfor
                Else
                    arr = .Range(.Cells(13, 1), .Cells(irow, 19))
                     For i = LBound(arr, 1) To UBound(arr, 1)
                        If arr(i, 17) <> "" And arr(i, 17) <> 0 And arr(i, 12) = 8 Then
                            s = s + 1
                            ReDim Preserve brr(1 To 5, 1 To s)
                            brr(1, s) = arr(i, 1)
                            brr(2, s) = arr(i, 2) 'ID
                            brr(3, s) = arr(i, 17) 'MANPOWER
                            brr(4, s) = arr(i, 18) 'MACHINERY
                            brr(5, s) = .Cells(7, 2)
                        End If
                    Next i
                End If
            End With
        wb.Close False
nextfor:
        Next
    End If
Next

Dim DSTR, processList
ReDim vlist(1 To UBound(brr, 2), 1 To 3)
For i = LBound(brr, 2) To UBound(brr, 2)
    vlist(i, 1) = brr(2, i)
    vlist(i, 2) = brr(3, i)
    If brr(4, i) = Empty Then
        vlist(i, 3) = 0
    Else
        vlist(i, 3) = brr(4, i)
    End If
Next
cnt = 0
DSTR = Sheets("FILENAME").Range("a1").CurrentRegion.Value

For p = 2 To UBound(DSTR, 1)
    For q = LBound(scope) To UBound(scope)
        If DSTR(p, 1) = scope(q) Then
            ReDim processList(0 To 0)
            For i = LBound(ovrList(q)(1)) To UBound(ovrList(q)(1))
                For j = LBound(vlist, 1) To UBound(vlist, 1)
                    If ovrList(q)(2)(i) = vlist(j, 1) Then
                        
                        ReDim Preserve processList(0 To cnt)
                        processList(cnt) = ovrList(q)(2)(i)
                        cnt = cnt + 1
                    End If
                Next
            Next
            cnt = 0
            If UBound(processList) = 0 And IsEmpty(processList(0)) Then
                GoTo exitcurrentloop
            End If
            result = BuildReportStructure(processList, q)
            result = StructureInfoMatching(result, q)
            result = PlanDB(result, q)
            'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\VFACT\"
            fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\VFACT\"
            Set wb = Workbooks.Open(fpath & Format(dd, "YYYYMMDD") & "\" & DSTR(p, 9) & ".xlsb")
            With wb.Sheets(DSTR(p, 5) & "-" & Format(DSTR(p, 6), "YYYYMMDD"))
                .Range("a13").Resize(UBound(result, 1), UBound(result, 2)) = result
            End With
            formatEndPV p, wb.Name
        End If
    Next
exitcurrentloop:
Next

End Sub


Function MatchingIPMTDB(ByVal strpvList As Variant)

Dim DBIPMT, ecpList

With Sheets("IPMTDB_2")
    irow = .Cells(Rows.Count, 4).End(xlUp).Row
    icol = .Cells(4, Columns.Count).End(xlToLeft).Column
    DBIPMT = .Range(.Cells(4, 1), .Cells(irow, icol)).Value
End With
ReDim result(1 To 23, 1 To 1)
ReDim ecpList(1 To 11, 1 To 1)
cnt = 0
For i = LBound(strpvList, 1) To UBound(strpvList, 1)
    If strpvList(i, 12) <> 8 Then
    cnt = cnt + 1
    ReDim Preserve result(1 To 23, 1 To cnt)
    For m = LBound(strpvList, 2) To UBound(strpvList, 2)
        result(m, cnt) = strpvList(i, m)
    Next
    Else
        For j = 2 To UBound(DBIPMT, 1)
            If strpvList(i, 2) = DBIPMT(j, 35) Then
                
                s = s + 1
                If s = 1 Then
                    cnt = cnt + 1
                    ReDim Preserve result(1 To 23, 1 To cnt)
                    For m = LBound(strpvList, 2) To UBound(strpvList, 2)
                        result(m, cnt) = strpvList(i, m)
                    Next
                End If
                cnt = cnt + 1

                ReDim Preserve result(1 To 23, 1 To cnt)
                result(1, cnt) = strpvList(i, 2) 'actid
                result(2, cnt) = DBIPMT(j, 4) 'DBcode
                result(9, cnt) = Trim("[" & DBIPMT(j, 21) & "]" & " " & DBIPMT(j, 18) & " / " & DBIPMT(j, 17))
                result(10, cnt) = DBIPMT(j, 21)
                result(11, cnt) = DBIPMT(j, 20)
                result(12, cnt) = 9
                result(13, cnt) = strpvList(i, 13)
                result(14, cnt) = strpvList(i, 14)
                result(15, cnt) = strpvList(i, 13)
                result(16, cnt) = strpvList(i, 14)
                result(17, cnt) = DBIPMT(j, 24)
                result(18, cnt) = DBIPMT(j, 27)
                result(19, cnt) = DBIPMT(j, 28)
                If Not IsEmpty(DBIPMT(j, 24)) Then
                    result(20, cnt) = Format(DBIPMT(j, 27) / DBIPMT(j, 24), "0%")
                End If
            End If
        Next
        If s = 0 Then
            cnt = cnt + 1
            ReDim Preserve result(1 To 23, 1 To cnt)
            For m = LBound(strpvList, 2) To UBound(strpvList, 2)
                result(m, cnt) = strpvList(i, m)
            Next
            cnt = cnt + 1
            ReDim Preserve result(1 To 23, 1 To cnt)
            result(9, cnt) = "ERR: DB CONNECTION ERROR. THE LOG WAS SENT TO THE IPMT. PLEASE WAIT FOR 1-2 DAYS."
            result(12, cnt) = 9
            ss = ss + 1
            ReDim Preserve ecpList(1 To 11, 1 To ss)
            For m = LBound(ecpList, 1) To UBound(ecpList, 1)
                ecpList(m, ss) = strpvList(i, m)
            Next
        End If
        s = 0
    End If
Next

ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
For i = LBound(result, 2) To UBound(result, 2)
    For j = LBound(result, 1) To UBound(result, 1)
        temp(i, j) = result(j, i)
    Next
Next
result = temp

ReDim temp(1 To UBound(ecpList, 2), 1 To UBound(ecpList, 1))
For i = LBound(ecpList, 2) To UBound(ecpList, 2)
    For j = LBound(ecpList, 1) To UBound(ecpList, 1)
        temp(i, j) = ecpList(j, i)
    Next
Next
ecpList = temp

With Sheets("EXCEPTION LIST")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    newrow = irow + 1
    .Range("a" & newrow).Resize(UBound(ecpList, 1), UBound(ecpList, 2)) = ecpList
End With

MatchingIPMTDB = result
End Function


Sub sendMP()

Dim sh34ar As Variant
Dim fso As Scripting.FileSystemObject, fd, fl
Dim i As Integer, j As Integer
Dim olApp As Outlook.Application, olItem As Outlook.MailItem
Dim ts As Scripting.TextStream, strBody As String, sigPath As String, sigText As String
Dim fpath As String

Set fso = New Scripting.FileSystemObject
sigPath = Environ("appdata") & "\Microsoft\Signatures\AutoSender.htm"
Set ts = fso.OpenTextFile(sigPath)
sigText = ts.ReadAll
ts.Close
dd = Date + 1

sh34ar = Sheets("FILENAME").Range("a1").CurrentRegion.Value

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\MP\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\MP\"
For i = 2 To UBound(sh34ar, 1)
    If sh34ar(i, 3) <> "" And sh34ar(i, 10) = "Y" Then
        Set olApp = CreateObject("Outlook.Application")
        Set olItem = olApp.CreateItem(olMailItem)
        strBody = "<body>" & _
                            "<head></head>" & _
                                "<span style='font-family: Arial;font-size:10pt;color:#012e75'>Good morning, colleagues," & "<br><br></span>" & _
                                "<span style='font-family: Arial;font-size:10pt;color:#012e75'>" & _
                                    "You are receiving a template for the manpower and machinery report." & "<br>" & _
                                    "Kindly input the number of manpower and machinery involved on " & Format(dd, "MMMM DD, YYYY") & "," & _
                                        " in the designated white cells within columns " & "Q" & " and " & "R " & "(the eighth level). " & "<br>" & _
                                    "The information provided in this report directly influences the generation of a physical volume report on the work performed tomorrow." & "<br>" & _
                                    "Please submit the completed report before " & Format(dd, "MMMM DD, YYYY") & ", at 11:00 a.m. to the email address: xieguangjie@cc7.cn." & "<br>" & _
                                        "When sending the report, " & _
                                        "you don't need to add any other attachments or text content." & "<br><br>" & _
                                    "If you have any questions, please contact:" & "<br>" & _
                                        "Xie Guangjie (+7 981 722 7260)" & "<br>" & "xieguangjie@cc7.cn" & "<br><br><br></span>" & _
                        "</body>"
    
        With olItem
            .Subject = sh34ar(i, 8)
            .HTMLBody = strBody & sigText
            .To = sh34ar(i, 3)
            .Attachments.Add fpath & Format(dd, "YYYYMMDD") & "\" & sh34ar(i, 8) & ".xlsb"
            .Display
            .Importance = olImportanceHigh
            '.SendUsingAccount = olApp.Session.Accounts("xieguangjie@cc7.cn")
                ' 尝试找到第一个匹配的账号
            Dim sendAccount As Outlook.Account
            Dim accountFound As Boolean
            accountFound = False
            
            For Each sendAccount In olApp.Session.Accounts
                If sendAccount.SmtpAddress = "xieguangjie@cc7.cn" Or sendAccount.SmtpAddress = "liyuansen@cc7.cn" Then
                    .SendUsingAccount = sendAccount
                    accountFound = True
                    Exit For
                End If
            Next
            
            ' 检查是否找到匹配账号
            If Not accountFound Then
                MsgBox "未找到指定的邮箱账户，请检查配置。"
                Exit Sub
            End If
            .Send
        End With
        Set olApp = Nothing
        Set olItem = Nothing
    End If
Next i


End Sub



Sub sendVFACT()

Dim sh34ar As Variant
Dim fso As Scripting.FileSystemObject, fd, fl
Dim i As Integer, j As Integer
Dim olApp As Outlook.Application, olItem As Outlook.MailItem
Dim ts As Scripting.TextStream, strBody As String, sigPath As String, sigText As String
Dim fpath As String

Set fso = New Scripting.FileSystemObject
sigPath = Environ("appdata") & "\Microsoft\Signatures\AutoSender.htm"
Set ts = fso.OpenTextFile(sigPath)
sigText = ts.ReadAll
ts.Close
dd = Date
sh34ar = Sheets("FILENAME").Range("a1").CurrentRegion.Value

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\VFACT\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\VFACT\"

For i = 2 To UBound(sh34ar, 1)
    If sh34ar(i, 3) <> "" And sh34ar(i, 10) = "Y" Then
        Set olApp = CreateObject("Outlook.Application")
        Set olItem = olApp.CreateItem(olMailItem)
        strBody = "<body>" & _
                            "<head></head>" & _
                                "<span style='font-family: Arial;font-size:10pt;color:#012e75'>Good morning, colleagues," & "<br><br></span>" & _
                                "<span style='font-family: Arial;font-size:10pt;color:#012e75'>" & _
                                    "You are receiving a template for the completed physical volume report." & "<br>" & _
                                    "This report has been generated in response to the manpower and machinery report that you submitted today. " & "<br>" & _
                                    "Kindly fill in the gray cells in column W (the ninth level) with the relevant information regarding the completed physical volume, which took place on " & Format(dd, "MMMM DD, YYYY") & "." & "<br>" & _
                                    "To ensure timely processing, please send the completed report to xieguangjie@cc7.cn " & "by 11:00 a.m. on " & Format(dd + 1, "MMMM DD, YYYY") & "." & "<br>" & _
                                        "No additional attachments or text content are required when sending the report." & _
                                        " Thank you for your cooperation." & "<br><br>" & _
                                    "If you have any questions, please contact:" & "<br>" & _
                                        "Xie Guangjie (+7 981 722 7260)" & "<br>" & "xieguangjie@cc7.com" & "<br><br><br></span>" & _
                        "</body>"
    
        With olItem
            .Subject = sh34ar(i, 9)
            .HTMLBody = strBody & sigText
            .To = sh34ar(i, 3)
            .Attachments.Add fpath & Format(dd, "YYYYMMDD") & "\" & sh34ar(i, 9) & ".xlsb"
            .Display
            .Importance = olImportanceHigh
            '.SendUsingAccount = olApp.Session.Accounts("xieguangjie@cc7.cn")
                ' 尝试找到第一个匹配的账号
            Dim sendAccount As Outlook.Account
            Dim accountFound As Boolean
            accountFound = False
            
            For Each sendAccount In olApp.Session.Accounts
                If sendAccount.SmtpAddress = "xieguangjie@cc7.cn" Or sendAccount.SmtpAddress = "liyuansen@cc7.cn" Then
                    .SendUsingAccount = sendAccount
                    accountFound = True
                    Exit For
                End If
            Next
            
            ' 检查是否找到匹配账号
            If Not accountFound Then
                MsgBox "未找到指定的邮箱账户，请检查配置。"
                Exit Sub
            End If
            .Send
        End With
        Set olApp = Nothing
        Set olItem = Nothing
    End If
Next i

End Sub

Sub sendATT3()

Dim sh34ar As Variant
Dim fso As Scripting.FileSystemObject, fd, fl
Dim i As Integer, j As Integer
Dim olApp As Outlook.Application, olItem As Outlook.MailItem
Dim ts As Scripting.TextStream, strBody As String, sigPath As String, sigText As String
Dim fpath As String, attachmentPath As String
Dim fileExists As Boolean, dd As Date

Set fso = New Scripting.FileSystemObject
sigPath = Environ("appdata") & "\Microsoft\Signatures\AutoSender.htm"
Set ts = fso.OpenTextFile(sigPath)
sigText = ts.ReadAll
ts.Close

dd = Date

sh34ar = Sheets("FILENAME").Range("a1").CurrentRegion.Value

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\VFACT\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\Att 3\"

For i = 2 To UBound(sh34ar, 1)
    If sh34ar(i, 3) <> "" And sh34ar(i, 10) = "Y" Then
        ' 构建附件路径
        attachmentPath = fpath & Format(dd, "YYYYMMDD") & "\" & sh34ar(i, 1) & "_计划周月报_" & GetWeekNumber_FridayToThursday(dd) & "W.xlsm"
        
        ' 检查文件是否存在
        fileExists = fso.fileExists(attachmentPath)
        
        If fileExists Then
            Set olApp = CreateObject("Outlook.Application")
            Set olItem = olApp.CreateItem(olMailItem)
            strBody = "<body>" & _
                                "<head></head>" & _
                                    "<span style='font-family: Arial;font-size:10pt;color:#012e75'>Good morning, colleagues," & "<br><br></span>" & _
                                    "<span style='font-family: Arial;font-size:10pt;color:#012e75'>" & _
                                        "You are receiving the weekly report template with actual volumes." & "<br>" & _
                                        "Kindly input your analysis result in the attachment and send it back no later than tomorrow." & "<br>" & _
                                        "If you have any questions, please contact:" & "<br>" & _
                                            "Xie Guangjie (+7 981 722 7260)" & "<br>" & "xieguangjie@cc7.com" & "<br><br><br></span>" & _
                            "</body>"
        
            With olItem
                .Subject = sh34ar(i, 2) & " Att-3_" & GetWeekNumber_FridayToThursday(dd) & "W"
                .HTMLBody = strBody & sigText
                .To = sh34ar(i, 3)
                .Attachments.Add attachmentPath
                .Display
                .Importance = olImportanceHigh
                ' 尝试找到第一个匹配的账号
                Dim sendAccount As Outlook.Account
                Dim accountFound As Boolean
                accountFound = False
                
                For Each sendAccount In olApp.Session.Accounts
                    If sendAccount.SmtpAddress = "xieguangjie@cc7.cn" Or sendAccount.SmtpAddress = "liyuansen@cc7.cn" Then
                        .SendUsingAccount = sendAccount
                        accountFound = True
                        Exit For
                    End If
                Next
                
                ' 检查是否找到匹配账号
                If Not accountFound Then
                    MsgBox "未找到指定的邮箱账户，请检查配置。"
                    Exit Sub
                End If
                .Send
            End With
            Set olApp = Nothing
            Set olItem = Nothing
        Else
            ' 文件不存在时的处理
            'MsgBox "附件文件不存在，跳过发送: " & vbCrLf & attachmentPath, vbExclamation
        End If
    End If
Next i

End Sub
Sub sendATT2()

Dim sh34ar As Variant
Dim fso As Scripting.FileSystemObject, fd, fl
Dim i As Integer, j As Integer
Dim olApp As Outlook.Application, olItem As Outlook.MailItem
Dim ts As Scripting.TextStream, strBody As String, sigPath As String, sigText As String
Dim fpath As String, attachmentPath As String
Dim fileExists As Boolean

Set fso = New Scripting.FileSystemObject
sigPath = Environ("appdata") & "\Microsoft\Signatures\AutoSender.htm"
Set ts = fso.OpenTextFile(sigPath)
sigText = ts.ReadAll
ts.Close

sh34ar = Sheets("FILENAME").Range("a1").CurrentRegion.Value

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\VFACT\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\Automate"

For i = 2 To UBound(sh34ar, 1)
    If sh34ar(i, 3) <> "" And sh34ar(i, 10) = "Y" Then
        ' 构建附件路径
        attachmentPath = fpath & "\Team_" & sh34ar(i, 1) & ".pbix"
        
        ' 检查文件是否存在
        fileExists = fso.fileExists(attachmentPath)
        
        If fileExists Then
            Set olApp = CreateObject("Outlook.Application")
            Set olItem = olApp.CreateItem(olMailItem)
            strBody = "<body>" & _
                                "<head></head>" & _
                                    "<span style='font-family: Arial;font-size:10pt;color:#012e75'>Good morning, colleagues," & "<br><br></span>" & _
                                    "<span style='font-family: Arial;font-size:10pt;color:#012e75'>" & _
                                        "You are receiving the native Power BI file for your information." & "<br>" & _
                                        "If you have any questions, please contact:" & "<br>" & _
                                            "Xie Guangjie (+7 981 722 7260)" & "<br>" & "xieguangjie@cc7.com" & "<br><br><br></span>" & _
                            "</body>"
        
            With olItem
                .Subject = sh34ar(i, 2) & " Att-2_" & GetWeekNumber_FridayToThursday(Date) & "W"
                .HTMLBody = strBody & sigText
                .To = sh34ar(i, 3)
                .Attachments.Add attachmentPath
                .Display
                .Importance = olImportanceHigh
                ' 尝试找到第一个匹配的账号
                Dim sendAccount As Outlook.Account
                Dim accountFound As Boolean
                accountFound = False
                
                For Each sendAccount In olApp.Session.Accounts
                    If sendAccount.SmtpAddress = "xieguangjie@cc7.cn" Or sendAccount.SmtpAddress = "liyuansen@cc7.cn" Then
                        .SendUsingAccount = sendAccount
                        accountFound = True
                        Exit For
                    End If
                Next
                
                ' 检查是否找到匹配账号
                If Not accountFound Then
                    MsgBox "未找到指定的邮箱账户，请检查配置。"
                    Exit Sub
                End If
                .Send
            End With
            Set olApp = Nothing
            Set olItem = Nothing
        Else
            ' 文件不存在时的处理
            'MsgBox "附件文件不存在，跳过发送: " & vbCrLf & attachmentPath, vbExclamation
        End If
    End If
Next i

End Sub
' 计算从周五开始的周数
Function GetWeekNumber_FridayToThursday(d As Date) As Integer
    ' 计算与基准日期的差值（这里以2020-01-03为基准，这一天是周五）
    Dim baseDate As Date
    baseDate = DateSerial(Year(Date), 1, 1)
    
    ' 计算总天数差
    Dim daysDiff As Long
    daysDiff = DateDiff("d", baseDate, d)
    
    ' 计算周数（每7天为一周）
    GetWeekNumber_FridayToThursday = Int(daysDiff / 7) + 1
End Function


Function PlanDB(ByVal strpvList As Variant, ByVal idx As Integer)

Dim DBIPMT, ecpList, wkpDB, VFACTDB



VFACTDB = Worksheets("VFACT").ListObjects("VFACTDB").DataBodyRange.Value
Set d = CreateObject("scripting.dictionary")
For i = LBound(VFACTDB, 1) To UBound(VFACTDB, 1)
    d(VFACTDB(i, 2) & "@" & VFACTDB(i, 13)) = d(VFACTDB(i, 2) & "@" & VFACTDB(i, 13)) + VFACTDB(i, 16)
Next

'k = d.keys
't = d.Items

'For i = LBound(k) To UBound(k)
'    k(i) = Split(k(i), "@")
'Next


cnt = 0
With Sheets("WorkSteps_C")
    irow = .Cells(Rows.Count, 4).End(xlUp).Row
    icol = .Cells(3, Columns.Count).End(xlToLeft).Column
    wkpDB = .Range(.Cells(4, 1), .Cells(irow, icol)).Value
    ReDim tempdb(1 To 5, 1 To 1)
    For i = LBound(wkpDB, 1) To UBound(wkpDB, 1)
        For j = 20 To 36
            If wkpDB(i, 1) <> Empty And .Cells(i + 3, j).Interior.Color = RGB(221, 235, 247) Then
                cnt = cnt + 1
                ReDim Preserve tempdb(1 To 5, 1 To cnt)
                tempdb(1, cnt) = wkpDB(i, 1)
                tempdb(2, cnt) = wkpDB(i, 3)
                tempdb(3, cnt) = wkpDB(i, 5)
                tempdb(4, cnt) = wkpDB(i, j)
                tempdb(5, cnt) = wkpDB(i + 1, j)
            End If
        Next
    Next
End With

ReDim temprng(1 To UBound(tempdb, 2), 1 To UBound(tempdb, 1))
For i = LBound(temprng, 1) To UBound(temprng, 1)
    For j = LBound(temprng, 2) To UBound(temprng, 2)
        temprng(i, j) = tempdb(j, i)
    Next
Next

tempdb = temprng

ReDim result(1 To 23, 1 To 1)
'ReDim ecpList(1 To 11, 1 To 1)
cnt = 0
For i = LBound(strpvList, 1) To UBound(strpvList, 1)
    If strpvList(i, 12) <> 8 Then
    cnt = cnt + 1
    ReDim Preserve result(1 To 23, 1 To cnt)
    For m = LBound(strpvList, 2) To UBound(strpvList, 2)
        result(m, cnt) = strpvList(i, m)
    Next
    Else
        For j = 1 To UBound(tempdb, 1)
            If strpvList(i, 11) = tempdb(j, 2) Then
                s = s + 1
                If s = 1 Then
                    cnt = cnt + 1
                    ReDim Preserve result(1 To 23, 1 To cnt)
                    For m = LBound(strpvList, 2) To UBound(strpvList, 2)
                        result(m, cnt) = strpvList(i, m)
                    Next
                    For x = LBound(vlist, 1) To UBound(vlist, 1)
                        If strpvList(i, 2) = vlist(x, 1) Then
                            result(22, cnt) = "'" & vlist(x, 2) & " / " & vlist(x, 3)
                        End If
                    Next
                End If
                cnt = cnt + 1
                For m = LBound(ovrList(idx)(2)) To UBound(ovrList(idx)(2))
                    If ovrList(idx)(2)(m) = strpvList(i, 2) Then
                        ReDim Preserve result(1 To 23, 1 To cnt)
                        For n = 1 To 11
                            result(n, cnt) = ovrList(idx)(n)(m)
                        Next
                        result(9, cnt) = tempdb(j, 4)
                        result(12, cnt) = 9
                        result(13, cnt) = strpvList(i, 13)
                        result(14, cnt) = strpvList(i, 14)
                        result(15, cnt) = strpvList(i, 15)
                        result(16, cnt) = strpvList(i, 16)
                        result(17, cnt) = tempdb(j, 3)
                        result(18, cnt) = Val(ovrList(idx)(20)(m))
                        'result(19, cnt) = Val(ovrList(idx)(35)(m))
                        If d.Exists(result(2, cnt) & "@" & result(9, cnt)) Then
                            result(19, cnt) = d(result(2, cnt) & "@" & result(9, cnt))
                        Else
                            result(19, cnt) = 0
                        End If
                        If Not IsEmpty(ovrList(idx)(20)(m)) And Val(ovrList(idx)(20)(m)) > 0 Then
                            result(20, cnt) = Format(result(19, cnt) / Val(ovrList(idx)(20)(m)), "0%")
                        End If

                    End If
                Next
            End If
        Next
        If s = 0 Then
            cnt = cnt + 1
            ReDim Preserve result(1 To 23, 1 To cnt)
            For m = LBound(strpvList, 2) To UBound(strpvList, 2)
                result(m, cnt) = strpvList(i, m)
            Next
            cnt = cnt + 1
            ReDim Preserve result(1 To 23, 1 To cnt)
            result(9, cnt) = "ERR: DB CONNECTION ERROR. THE LOG WAS SENT TO THE IPMT. PLEASE WAIT FOR 1-2 DAYS."
            result(12, cnt) = 9
            ss = ss + 1
            ReDim Preserve ecpList(1 To 11, 1 To ss)
            For m = LBound(ecpList, 1) To UBound(ecpList, 1)
                ecpList(m, ss) = strpvList(i, m)
            Next
        End If
        s = 0
    End If
Next

ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
For i = LBound(result, 2) To UBound(result, 2)
    For j = LBound(result, 1) To UBound(result, 1)
        temp(i, j) = result(j, i)
    Next
Next
result = temp

'ReDim temp(1 To UBound(ecpList, 2), 1 To UBound(ecpList, 1))
'For i = LBound(ecpList, 2) To UBound(ecpList, 2)
'    For j = LBound(ecpList, 1) To UBound(ecpList, 1)
'        temp(i, j) = ecpList(j, i)
'    Next
'Next
'ecpList = temp

'With Sheets("EXCEPTION LIST")
'    irow = .Cells(Rows.Count, 1).End(xlUp).Row
'    newrow = irow + 1
'    .Range("a" & newrow).Resize(UBound(ecpList, 1), UBound(ecpList, 2)) = ecpList
'End With

PlanDB = result
End Function

















