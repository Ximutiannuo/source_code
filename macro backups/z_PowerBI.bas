Attribute VB_Name = "z_powerBi"
Sub exportFacilityList()


With Sheets("Facility List")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(3, 1), .Cells(irow, icol)).Value
    ReDim blockList(1 To UBound(vdata, 2), 1 To 1)
    For i = LBound(vdata, 1) To UBound(vdata, 1)
        If vdata(i, 11) = "" Then
        Else
            cnt = cnt + 1
            ReDim Preserve blockList(1 To UBound(vdata, 2), 1 To cnt)
            For j = LBound(vdata, 2) To UBound(vdata, 2)
                blockList(j, cnt) = CStr(vdata(i, j))
            Next
        End If
    Next
    ReDim temp(1 To UBound(blockList, 2), 1 To UBound(blockList, 1))
    For i = LBound(blockList, 2) To UBound(blockList, 2)
        For j = LBound(blockList, 1) To UBound(blockList, 1)
            temp(i, j) = blockList(j, i)
        Next
    Next
    blockList = temp
End With
' block, project, subproject, train, unit, mainQ(xx), mainblock, descriptions.
ReDim result(1 To UBound(blockList, 1) + 1, 1 To 11)
result(1, 1) = "Block"
result(1, 2) = "Project"
result(1, 3) = "Sub-Project CODE"
result(1, 4) = "Train"
result(1, 5) = "Unit"
result(1, 6) = "Main_Block"
result(1, 7) = "Descriptions"
result(1, 8) = "SIMPLEBLK"
result(1, 9) = "!BCC_Quarter"
result(1, 10) = "!BCC_START-UP SEQUENCE"
result(1, 11) = "Title Type"

For i = 2 To UBound(result, 1)
    result(i, 1) = blockList(i - 1, 10)
    result(i, 2) = blockList(i - 1, 11)
    result(i, 3) = blockList(i - 1, 12)
    result(i, 4) = blockList(i - 1, 13)
    result(i, 5) = blockList(i - 1, 14)
    result(i, 6) = CStr(Mid(blockList(i - 1, 10), 6, 5))
    result(i, 7) = blockList(i - 1, 16)
    result(i, 8) = blockList(i - 1, 17)
    result(i, 9) = blockList(i - 1, 18)
    result(i, 10) = blockList(i - 1, 19)
    result(i, 11) = blockList(i - 1, 20)
Next

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\Facility_List.xlsx"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\Facility_List.xlsx"
Set wb = Workbooks.Open(fpath)

With ActiveSheet
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    .Range("g1:g" & UBound(result, 1)).NumberFormatLocal = "@"
    If irow > 1 Then
        .Range("a2:a" & irow).EntireRow.Clear
    End If
    .Range("f1:F" & UBound(result, 1)).NumberFormatLocal = "@"
    .Range("a1").Resize(UBound(result, 1), UBound(result, 2)) = result
    .ListObjects.Add(xlSrcRange, Range("a1").CurrentRegion, , xlYes).Name = "FacList"
    
   
End With

wb.Close True
Call exportActList_C

End Sub

'ID, WBS, BLOCK, DESCRIPTION,SCOPE
Sub exportActList_C()


With Sheets("Activity List")
    irow = .Cells(Rows.Count, 2).End(xlUp).Row
    icol = .Cells(6, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
    ReDim actList(1 To UBound(vdata, 2), 1 To 1)
    For i = LBound(vdata, 1) To UBound(vdata, 1)
        If vdata(i, 3) = "" Then
        Else
            cnt = cnt + 1
            ReDim Preserve actList(1 To UBound(vdata, 2), 1 To cnt)
            For j = LBound(vdata, 2) To UBound(vdata, 2)
                actList(j, cnt) = CStr(vdata(i, j))
            Next
        End If
    Next
    ReDim temp(1 To UBound(actList, 2), 1 To UBound(actList, 1))
    For i = LBound(actList, 2) To UBound(actList, 2)
        For j = LBound(actList, 1) To UBound(actList, 1)
            temp(i, j) = actList(j, i)
        Next
    Next
    actList = temp
End With
' block, project, subproject, train, unit, mainQ(xx), mainblock, descriptions.
ReDim result(1 To UBound(actList, 1) + 1, 1 To 10)
result(1, 1) = "WBS"
result(1, 2) = "ACT ID"
result(1, 3) = "Block"
result(1, 4) = "Act Description"
result(1, 5) = "SCOPE"
result(1, 6) = "Discipline"
result(1, 7) = "Work Package"
result(1, 8) = "Contract Phase"
result(1, 9) = "Weight Factor"
result(1, 10) = "Man Hours"


For i = 2 To UBound(result, 1)
    result(i, 1) = actList(i - 1, 1)
    result(i, 2) = actList(i - 1, 2)
    result(i, 3) = actList(i - 1, 8)
    result(i, 4) = actList(i - 1, 11)
    result(i, 5) = actList(i - 1, 14)
    result(i, 6) = actList(i - 1, 12)
    result(i, 7) = actList(i - 1, 13)
    result(i, 8) = actList(i - 1, 19)
    result(i, 9) = actList(i - 1, 25)
    result(i, 10) = actList(i - 1, 21)
Next

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\Activity_List.xlsx"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\Activity_List.xlsx"
Set wb = Workbooks.Open(fpath)

With ActiveSheet
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    .Range("g1:g" & UBound(result, 1)).NumberFormatLocal = "@"
    If irow > 1 Then
        .Range("a2:a" & irow).EntireRow.Clear
    End If
    .Range("a1").Resize(UBound(result, 1), UBound(result, 2)) = result
    .ListObjects.Add(xlSrcRange, Range("a1").CurrentRegion, , xlYes).Name = "ActList"
    
   
End With
wb.Close True
Call exportActList_OWF

End Sub

Sub volumeControl()

With Sheets("UpdateQuantity")
    Set tbl = .ListObjects("RSC_Define")
    result = tbl.Range
End With

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\VolumeControl.xlsx"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\VolumeControl.xlsx"
Set wb = Workbooks.Open(fpath)
With ActiveSheet
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    If irow > 1 Then
        .Range("a2:a" & irow).EntireRow.Delete
    End If
    .Range("a1").Resize(UBound(result, 1), 19) = result
    .ListObjects.Add(xlSrcRange, Range("a1").CurrentRegion, , xlYes).Name = "VolumeControl"
    
   
End With
wb.Close True
Call ExportOWF
End Sub



Sub exportActList_OWF()


With Sheets("Activity List(O_WF)")
    vdata = .ListObjects("OWF").DataBodyRange.Value
    ReDim actList(1 To UBound(vdata, 2), 1 To 1)
    For i = LBound(vdata, 1) To UBound(vdata, 1)
        If vdata(i, 3) = "" Then
        Else
            cnt = cnt + 1
            ReDim Preserve actList(1 To UBound(vdata, 2), 1 To cnt)
            For j = LBound(vdata, 2) To UBound(vdata, 2)
                actList(j, cnt) = CStr(vdata(i, j))
            Next
        End If
    Next
    ReDim temp(1 To UBound(actList, 2), 1 To UBound(actList, 1))
    For i = LBound(actList, 2) To UBound(actList, 2)
        For j = LBound(actList, 1) To UBound(actList, 1)
            temp(i, j) = actList(j, i)
        Next
    Next
    actList = temp
End With
' block, project, subproject, train, unit, mainQ(xx), mainblock, descriptions.
ReDim result(1 To UBound(actList, 1) + 1, 1 To 10)
result(1, 1) = "WBS"
result(1, 2) = "ACT ID"
result(1, 3) = "Block"
result(1, 4) = "Act Description"
result(1, 5) = "SCOPE"
result(1, 6) = "Discipline"
result(1, 7) = "Work Package"
result(1, 8) = "Contract Phase"
result(1, 9) = "Weight Factor"
result(1, 10) = "Man Hours"


For i = 2 To UBound(result, 1)
    result(i, 1) = actList(i - 1, 5) 'wbs
    result(i, 2) = actList(i - 1, 3) 'id
    result(i, 3) = actList(i - 1, 12) 'block
    result(i, 4) = actList(i - 1, 6) 'act description
    result(i, 5) = actList(i - 1, 15) 'scope
    result(i, 6) = actList(i - 1, 13) 'discipline
    result(i, 7) = actList(i - 1, 14) 'work package
    result(i, 8) = actList(i - 1, 20) 'contract phase
    result(i, 9) = actList(i - 1, 29) 'weight factor
    result(i, 10) = 0 'manhours
Next

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\Activity_List.xlsx"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\Activity_List(OWF).xlsx"
Set wb = Workbooks.Open(fpath)

With ActiveSheet
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    .Range("g1:g" & UBound(result, 1)).NumberFormatLocal = "@"
    .Range("h1:h" & UBound(result, 1)).NumberFormatLocal = "@"
    If irow > 1 Then
        .Range("a2:a" & irow).EntireRow.Clear
    End If
    .Range("a1").Resize(UBound(result, 1), UBound(result, 2)) = result
    .ListObjects.Add(xlSrcRange, Range("a1").CurrentRegion, , xlYes).Name = "ActList_OWF"
    
   
End With
wb.Close True
Call volumeControl

End Sub

Sub ExportOWF()
ThisWorkbook.Activate
With Sheets("Overall WF Table")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(2, 1), .Cells(irow, icol)).Value2
End With
scol = 18
ReDim result_key(1 To 2, 1 To 1)
ReDim result_item(1 To icol - scol + 1, 1 To 1)
For i = LBound(vdata, 1) To UBound(vdata, 1)
    If vdata(i, 2) <> "" And vdata(i, 1) = "Actual" Then
        cnt = cnt + 1
        ReDim Preserve result_key(1 To 2, 1 To cnt)
        ReDim Preserve result_item(1 To icol - scol + 1, 1 To cnt)
        result_key(1, cnt) = vdata(i, 2)
        result_key(2, cnt) = "Actual Units"
        For j = scol To UBound(vdata, 2)
            result_item(j - 17, cnt) = vdata(i, j) * vdata(i, 13)
        Next
    End If
Next
result_key = Application.Transpose(result_key)
result_item = Application.Transpose(result_item)
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\OWF.xlsx"
Set wb = Workbooks.Open(fpath)
With ActiveSheet
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    If irow > 1 Then
        .Range("a2:a" & irow).EntireRow.Clear
    End If
    .Range("a2").Resize(UBound(result_key, 1), UBound(result_key, 2)) = result_key
    .Range("c2").Resize(UBound(result_item, 1), UBound(result_item, 2)) = result_item
End With
wb.Close True
MsgBox "Power BI Updated!"
End Sub
