Attribute VB_Name = "k_cActDurChange"
Sub ChangeCActDuration()

Dim cPkg, result, clist

With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 12
    clist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With

With Sheets("Standard Relation & Duration")
    cPkg = .Range("ae1:az87")
End With

ReDim result(1 To 2, 1 To 1)

For i = LBound(clist, 1) To UBound(clist, 1)
    If clist(i, 16) = "Y" Then
        For j = 2 To UBound(cPkg, 1)
            If clist(i, 11) = cPkg(j, 1) Then
                If clist(i, 15) >= cPkg(j, 6) And clist(i, 15) < cPkg(j, 8) Then
                    cnt = cnt + 1
                    ReDim Preserve result(1 To 2, 1 To cnt)
                    result(1, cnt) = clist(i, 2)
                    result(2, cnt) = cPkg(j, 7)
                ElseIf IsEmpty(clist(i, 15)) Or clist(i, 15) = 0 Then
                    cnt = cnt + 1
                    ReDim Preserve result(1 To 2, 1 To cnt)
                    result(1, cnt) = clist(i, 2)
                    result(2, cnt) = cPkg(j, 7)
                Else
                    For m = 8 To UBound(cPkg, 2) - 2 Step 2
                        If clist(i, 15) >= cPkg(j, m) And clist(i, 15) < cPkg(j, m + 2) Then
                            cnt = cnt + 1
                            ReDim Preserve result(1 To 2, 1 To cnt)
                            result(1, cnt) = clist(i, 2)
                            result(2, cnt) = Round(cPkg(j, m + 1), 0)
                            Exit For
                        End If
                    Next
                End If
            End If
        Next
    End If
Next

ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
For i = LBound(result, 2) To UBound(result, 2)
    For j = LBound(result, 1) To UBound(result, 1)
        temp(i, j) = result(j, i)
    Next
Next
result = temp
Sheets("Standard Relation & Duration").Range("bc1").Resize(UBound(result, 1), UBound(result, 2)) = result




End Sub
