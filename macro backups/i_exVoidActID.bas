Attribute VB_Name = "i_exVoidActID"
Sub getRealAct()

Dim vdata, result, actList
With Sheets("Temp_Completed")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Range("p1").Column
    vdata = .Range(.Cells(2, 1), .Cells(irow, icol)).Value
End With

ReDim arr(1 To UBound(vdata, 2), 1 To 1)
For i = LBound(vdata, 1) To UBound(vdata, 1)
    If vdata(i, 15) > 0 Then
        cnt = cnt + 1
        ReDim Preserve arr(1 To UBound(vdata, 2), 1 To cnt)
        For j = LBound(vdata, 2) To UBound(vdata, 2)
            arr(j, cnt) = vdata(i, j)
        Next
    End If
Next

ReDim temp(1 To UBound(arr, 2), 1 To UBound(arr, 1))
For i = LBound(arr, 2) To UBound(arr, 2)
    For j = LBound(arr, 1) To UBound(arr, 1)
        temp(i, j) = arr(j, i)
    Next
Next

arr = temp


With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 12
    actList = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With

cnt = 0
ReDim brr(1 To UBound(arr, 2), 1 To 1)
For i = LBound(arr, 1) To UBound(arr, 1)
    For j = LBound(actList, 1) To UBound(actList, 1)
        If arr(i, 1) = actList(j, 1) And arr(i, 12) = actList(j, 12) And arr(i, 15) > 0 Then
            cnt = cnt + 1
            If IsEmpty(actList(i, 14)) Then
                actList(j, 14) = arr(i, 14)
            Else
                actList(j, 14) = actList(j, 14) & "/" & arr(i, 14)
            End If
            actList(j, 15) = actList(j, 15) + arr(i, 15)
        End If
    Next
    If cnt = 0 And arr(i, 15) > 0 Then
        cnts = cnts + 1
        ReDim Preserve brr(1 To UBound(arr, 2), 1 To cnts)
        For m = LBound(arr, 2) To UBound(arr, 2)
            brr(m, cnts) = arr(i, m)
        Next
    End If
    cnt = 0
Next

ReDim temp(1 To UBound(brr, 2), 1 To UBound(brr, 1))
For i = LBound(brr, 2) To UBound(brr, 2)
    For j = LBound(brr, 1) To UBound(brr, 1)
        temp(i, j) = brr(j, i)
    Next
Next

brr = temp

cnt = 0

ReDim notgiven(1 To UBound(actList, 2), 1 To 1)

For i = LBound(actList, 1) To UBound(actList, 1)
    If actList(i, 15) > 0 Then

    Else
        cnt = cnt + 1
        ReDim Preserve notgiven(1 To UBound(actList, 2), 1 To cnt)
        For j = LBound(actList, 2) To UBound(actList, 2)
            notgiven(j, cnt) = actList(i, j)
        Next
    End If
Next


ReDim temp(1 To UBound(notgiven, 2), 1 To UBound(notgiven, 1))
For i = LBound(notgiven, 2) To UBound(notgiven, 2)
    For j = LBound(notgiven, 1) To UBound(notgiven, 1)
        temp(i, j) = notgiven(j, i)
    Next
Next

notgiven = temp




For i = LBound(notgiven, 1) To UBound(notgiven, 1)
    For j = LBound(brr, 1) To UBound(brr, 1)
        If brr(j, 1) = notgiven(i, 1) Then
            If IsEmpty(notgiven(i, 14)) Then
                notgiven(i, 14) = brr(j, 14)
            Else
                notgiven(i, 14) = notgiven(i, 14) & "/" & brr(j, 14)
            End If
            notgiven(i, 15) = notgiven(i, 15) + brr(j, 15)
            Exit For
        End If
    Next
Next

For i = LBound(actList, 1) To UBound(actList, 1)
    For j = LBound(notgiven, 1) To UBound(notgiven, 1)
        If actList(i, 2) = notgiven(j, 2) Then
            actList(i, 14) = notgiven(j, 14)
            actList(i, 15) = notgiven(j, 15)
            Exit For
        End If
    Next
Next

Sheets("Activity List").Range("a6").Resize(UBound(actList, 1), UBound(actList, 2)) = actList

End Sub
