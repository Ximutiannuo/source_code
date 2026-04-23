Attribute VB_Name = "z_changeProcurementActName"
Sub ChangeProName()

Dim plist, result


With Sheets("Activity List (P)")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 15
    plist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
    ReDim result(1 To UBound(plist, 1), 1 To 1)
    For i = LBound(plist, 1) To UBound(plist, 1)
        If Not IsEmpty(plist(i, 12)) Then
            kywd = "(" & Split(plist(i, 12), "-")(3) & "-" & Split(plist(i, 12), "-")(4) & ")"
            result(i, 1) = Split(plist(i, 9), kywd)(0)
            result(i, 1) = result(i, 1) & "(" & plist(i, 12) & ")"
        Else
            result(i, 1) = plist(i, 9)
        End If
    Next
    .Range("p6").Resize(UBound(result, 1), 1) = result
End With



End Sub
