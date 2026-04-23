Attribute VB_Name = "h_seperate2"
Sub UPDATEActListbyTitle()

Application.ScreenUpdating = False
Application.Calculation = xlCalculationManual

'PREPARE RAW DATA FOR CHECKING.
With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 1
    clist = .Range(.Cells(6, 1), .Cells(irow, icol))
End With
'3,5,6,10 project, team, name, id
ReDim temp(1 To UBound(clist, 1), 1 To icol)
Set d = CreateObject("scripting.dictionary")
For i = 2 To UBound(clist, 1)
    If clist(i, 3) <> "" Then
        tempstr = clist(i, 12)
        If Not d.Exists(tempstr) Then
            ReDim brr(1 To icol)
        Else
            brr = d(tempstr)
        End If
        For m = LBound(brr) To UBound(brr)
            If clist(i, m) <> "" Then
                brr(m) = brr(m) & "@" & clist(i, m)
            Else
                brr(m) = brr(m) & "@" & " "
            End If
        Next
        d(tempstr) = brr
    End If
Next

k = d.Keys
t = d.Items
Set d = Nothing

For i = LBound(t) To UBound(t)
    For j = LBound(t(i)) To UBound(t(i))
        Dim tempArray As Variant
        tempArray = Split(Right(t(i)(j), Len(t(i)(j)) - 1), "@")
        t(i)(j) = tempArray
    Next
Next


With Sheets("UpdateQuantity")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    existID = .Range("a2:l" & irow)
End With

'GET MISSING ITEMS.

ReDim missingitem(1 To 1)
Set d = CreateObject("scripting.dictionary")
For Each it In Application.Index(existID, 0, 1)
    NewElement = d.item(it)
Next

cnt = 0
For Each it In Application.Index(clist, 0, 2)
    itr = itr + 1
    If Left(it, 3) <> "EX0" And clist(itr, 3) <> "" Then
        If Not d.Exists(it) Then
            cnt = cnt + 1
            ReDim Preserve missingitem(1 To cnt)
            missingitem(cnt) = it
        End If
    End If
Next

Set d = Nothing
cnt = 0
itr = 0
'GET DELETE ITEMS.
ReDim DelItem(1 To 1)
Set d = CreateObject("scripting.dictionary")
For Each it In Application.Index(clist, 0, 2)
    itr = itr + 1
    If Left(it, 3) <> "EX0" And clist(itr, 3) <> "" Then
        DelElement = d.item(it)
        d(it) = itr
    End If
Next
k1 = d.Keys
t1 = d.Items

For Each it In Application.Index(existID, 0, 1)
    If Not d.Exists(it) Then
        cnt = cnt + 1
        ReDim Preserve DelItem(1 To cnt)
        DelItem(cnt) = it
    End If
Next
Set d = Nothing
cnt = 0
itr = 0

'GET CHAGNE ITEMS.
ReDim changeItem(1 To 1)
Set d = CreateObject("scripting.dictionary")
For Each it In Application.Index(existID, 0, 1)
    itr = itr + 1
    If Len(existID(itr, 11)) < 3 Then
        NewElement = d.item(it & "-" & "NULL" & "-" & existID(itr, 8))
    Else
        NewElement = d.item(it & "-" & existID(itr, 11) & "-" & existID(itr, 8))
    End If
Next

cnt = 0
itr = 0
For Each it In Application.Index(clist, 0, 2)
    itr = itr + 1
    If Left(it, 3) <> "EX0" And clist(itr, 3) <> "" Then
        If clist(itr, 14) = "" Then
            If Not d.Exists(it & "-" & "NULL" & "-" & clist(itr, 34)) Then
                cnt = cnt + 1
                ReDim Preserve changeItem(1 To cnt)
                changeItem(cnt) = it
            End If
        Else
            If Not d.Exists(it & "-" & clist(itr, 14) & "-" & clist(itr, 34)) Then
                cnt = cnt + 1
                ReDim Preserve changeItem(1 To cnt)
                changeItem(cnt) = it
            End If
        End If
    End If
Next

Set d = Nothing
cnt = 0
itr = 0

'TRANSPOSE TO LISTS - TO ADD ONE.
ReDim newAct(1 To UBound(missingitem, 1), 1 To 28)
For i = LBound(newAct, 1) To UBound(newAct, 1)
    For j = LBound(k1) To UBound(k1)
        If missingitem(i) = clist(t1(j), 2) Then
            For m = LBound(newAct, 2) To 19
                newAct(i, m) = clist(t1(j), m)
            Next
            newAct(i, 25) = clist(t1(j), 34)
        End If
    Next
Next

'TRANSPOSE TO LISTS - TO CHANGE ONE.
ReDim changeAct(1 To UBound(changeItem, 1), 1 To 28)
For i = LBound(changeAct, 1) To UBound(changeAct, 1)
    For j = LBound(clist, 1) To UBound(clist, 1)
        If changeItem(i) = clist(j, 2) Then
            For m = LBound(changeAct, 2) To 19
                changeAct(i, m) = clist(j, m)
            Next
            changeAct(i, 25) = clist(j, 34)
        End If
    Next
Next




If IsEmpty(missingitem(1)) And IsEmpty(DelItem(1)) And IsEmpty(changeItem(1)) Then
    MsgBox "No Missing Item need to be added, and no item need to be deleted or changed."
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
    Exit Sub
End If
Set fso = CreateObject("scripting.filesystemobject")
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\GCC EGPC Project Level 3 Schedule Breakdown\R1\"
Set fd = fso.GetFolder(fpath)

If Not IsEmpty(missingitem(1)) Then
    For i = LBound(newAct, 1) To UBound(newAct, 1)
        For Each subfd In fd.SubFolders
            If subfd.Name = newAct(i, 4) Then
                For Each fl In subfd.Files
                    If Split(fl.Name, ".")(0) = newAct(i, 12) Then
                        Set wb = Workbooks.Open(fl.Path)
                        With ActiveSheet
                            If .AutoFilterMode = True And .FilterMode = True Then
                                .ShowAllData
                            End If
                            .Rows("1:10000").Hidden = False
                            irow = .Cells(Rows.Count, 1).End(xlUp).Row + 1
                            .Range("a" & irow).Resize(1, UBound(newAct, 2)) = Application.Index(newAct, i, 0)
                            .Range("a1").CurrentRegion.Select
                            With Selection
                                .EntireColumn.AutoFit
                                .Borders.LineStyle = xlContinuous
                                .Borders.Color = RGB(0, 0, 0)
                                .Borders.Weight = xlThin
                            End With
                        End With
                        wb.Save
                        wb.Close
                    End If
                Next
            End If
        Next
    Next
End If
If Not IsEmpty(DelItem(1)) Then
    For i = LBound(DelItem) To UBound(DelItem, 1)
        For Each subfd In fd.SubFolders
            If Left(subfd.Name, 2) = Left(DelItem(i), 2) Then
                For Each fl In subfd.Files
                    If Left(fl.Name, 2) = Mid(DelItem(i), 13, 2) Then
                        Set wb = Workbooks.Open(fl.Path)
                        With ActiveSheet
                            If .AutoFilterMode = True And .FilterMode = True Then
                                .ShowAllData
                            End If
                            .Rows("1:10000").Hidden = False

                            irow = .Cells(Rows.Count, 1).End(xlUp).Row
                            
                            For j = 2 To irow
                                If .Cells(j, 2) = DelItem(i) Then
                                    .Cells(j, 2).EntireRow.Delete
                                End If
                            Next
                        End With
                        wb.Save
                        wb.Close
                    End If
                Next
            End If
        Next
    Next
End If
If Not IsEmpty(changeItem(1)) Then
    For i = LBound(changeAct) To UBound(changeAct, 1)
        For Each subfd In fd.SubFolders
            If subfd.Name = changeAct(i, 4) Then
                For Each fl In subfd.Files
                    If Split(fl.Name, ".")(0) = changeAct(i, 12) Then
                        Set wb = Workbooks.Open(fl.Path)
                        With ActiveSheet
                            If .AutoFilterMode = True And .FilterMode = True Then
                                .ShowAllData
                            End If
                            .Rows("1:10000").Hidden = False
                            irow = .Cells(Rows.Count, 1).End(xlUp).Row
                            For j = 2 To irow
                                If .Cells(j, 2) = changeItem(i) Then
                                    .Cells(j, 14) = changeAct(i, 14)
                                    .Cells(j, 25) = changeAct(i, 25)
                                End If
                            Next
                        End With
                        wb.Save
                        wb.AutoSaveOn = True
                        wb.Close
                    End If
                Next
            End If
        Next
    Next
End If





MsgBox "Step 2 Completed - updated distributed files!"

Application.ScreenUpdating = True
Application.Calculation = xlCalculationAutomatic


End Sub



Sub FixDistributeDB()

Dim existID As Variant
Dim toDelItem
Dim DelItem

With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 1
    clist = .Range(.Cells(6, 1), .Cells(irow, icol))
End With
With Sheets("UpdateQuantity")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    existID = .Range("a2:n" & irow)
End With

ReDim toDelItem(1 To 2, 1 To 1)
For i = LBound(existID, 1) To UBound(existID, 1)
    If existID(i, 14) > 1 Then
        cnt = cnt + 1
        ReDim Preserve toDelItem(1 To 2, 1 To cnt)
        toDelItem(1, cnt) = existID(i, 1)
        toDelItem(2, cnt) = existID(i, 14)
    End If
Next

ReDim DelItem(1 To UBound(toDelItem, 2), 1 To 4)
For i = LBound(DelItem, 1) To UBound(DelItem, 1)
    For j = LBound(clist, 1) To UBound(clist, 1)
        If toDelItem(1, i) = clist(j, 2) Then
            DelItem(i, 1) = clist(j, 2)
            DelItem(i, 2) = clist(j, 4)
            DelItem(i, 3) = clist(j, 8) & ".xlsx"
            DelItem(i, 4) = toDelItem(2, i)
            Exit For
        End If
    Next
Next
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\GCC EGPC Project Level 3 Schedule Breakdown\"
Set fso = CreateObject("scripting.filesystemobject")
Set fd = fso.GetFolder(fpath)

For i = LBound(DelItem, 1) To UBound(DelItem, 1)
    cnt = 0
    For Each subfd In fd.SubFolders
        If subfd.Name = DelItem(i, 2) Then
            For Each fl In subfd.Files
                If fl.Name = DelItem(i, 3) Then
                    Set wb = Workbooks.Open(fl.Path)
                    With ActiveSheet
                        If .AutoFilterMode = True And .FilterMode = True Then
                            .ShowAllData
                        End If
                        If .AutoFilterMode = True And .FilterMode = True Then
                            .ShowAllData
                        End If
                        .Rows("1:1000").Hidden = False
                        irow = .Cells(Rows.Count, 1).End(xlUp).Row
                        For m = irow To 2 Step -1
                            If .Cells(m, 2) = DelItem(i, 1) Then
                                cnt = cnt + 1
                                If cnt < DelItem(i, 4) Then
                                    .Cells(m, 1).EntireRow.Delete
                                Else
                                    wb.Save
                                    wb.AutoSaveOn = True
                                    wb.Close
                                    Exit For
                      
                                End If
                            End If
                        Next

                    End With
                    wb.Save
                    wb.AutoSaveOn = True
                    wb.Close

                End If
            Next
        End If
    Next
Next

End Sub

