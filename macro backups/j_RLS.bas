Attribute VB_Name = "j_RLS"
Sub createRelationECEP()

Dim elist, plist, clist, mcRLS

ReDim result(1 To 4, 1 To 1)

'With Sheets("Activity List (E)")
'    irow = .Cells(Rows.Count, 3).End(xlUp).Row
'    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 14
'    elist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
'End With
'
'ReDim brr(1 To 3)
'Set d = CreateObject("scripting.dictionary")
'For i = LBound(elist, 1) To UBound(elist, 1)
'    tempstr = Split(elist(i, 9), ")")(1)
'    If Not d.exists(tempstr) Then
'        ReDim brr(1 To 3)
'    Else
'        brr = d(tempstr)
'    End If
'    If Split(elist(i, 9), ")")(0) = "(IFR" Then
'        brr(1) = elist(i, 2)
'    ElseIf Split(elist(i, 9), ")")(0) = "(IFC" Then
'        brr(2) = elist(i, 2)
'    ElseIf Split(elist(i, 9), ")")(0) = "(AFC" Then
'        brr(3) = elist(i, 2)
'    End If
'    d(tempstr) = brr
'Next
'k = d.keys
't = d.items
'For i = LBound(k) To UBound(k)
'    cnt = cnt + 1
'    ReDim Preserve result(1 To 4, 1 To cnt)
'    result(1, cnt) = t(i)(1)
'    result(2, cnt) = t(i)(2)
'    result(3, cnt) = "FS"
'    result(4, cnt) = 30
'    cnt = cnt + 1
'    ReDim Preserve result(1 To 4, 1 To cnt)
'    result(1, cnt) = t(i)(2)
'    result(2, cnt) = t(i)(3)
'    result(3, cnt) = "FS"
'    result(4, cnt) = 15
'
'Next
'
'
'With Sheets("Activity List (P)")
'    irow = .Cells(Rows.Count, 3).End(xlUp).Row
'    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 15
'    plist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
'End With
'
'For i = LBound(elist, 1) To UBound(elist, 1)
'    If Left(elist(i, 9), 5) = "(IFR)" Then
'        tempE = Split(elist(i, 9), "-")(6) & "-" & Split(elist(i, 9), "-")(4) & "-" & Split(elist(i, 9), "-")(5) & "-" & elist(i, 11) & "-" & elist(i, 12)
'        For j = LBound(plist, 1) To UBound(plist, 1)
'            tempP = plist(j, 12)
'            If tempE = tempP And plist(j, 13) = "Y" Then
'                cnt = cnt + 1
'                ReDim Preserve result(1 To 4, 1 To cnt)
'                result(1, cnt) = elist(i, 2)
'                result(2, cnt) = plist(j, 2)
'                result(3, cnt) = "FS"
'                result(4, cnt) = 0
'            End If
'        Next
'    End If
'Next
With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    clist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With

'For i = LBound(elist, 1) To UBound(elist, 1)
'    If Left(elist(i, 9), 5) = "(AFC)" Then
'        tempE = Split(elist(i, 9), "-")(6) & "-" & Split(elist(i, 9), "-")(4) & "-" & Split(elist(i, 9), "-")(5) & "-" & elist(i, 11) & "-" & elist(i, 12)
'        For j = LBound(clist, 1) To UBound(clist, 1)
'            tempC = clist(j, 12)
'            If tempE = tempC And clist(j, 16) = "Y" Then
'                cnt = cnt + 1
'                ReDim Preserve result(1 To 4, 1 To cnt)
'                result(1, cnt) = elist(i, 2)
'                result(2, cnt) = clist(j, 2)
'                result(3, cnt) = "FS"
'                result(4, cnt) = 0
'            End If
'        Next
'    End If
'Next

With Sheets("Standard Relation & Duration")
    mcRLS = .Range("q2:aa87")
End With

For i = LBound(clist, 1) To UBound(clist, 1)
    If clist(i, 31) = "Y" Then
        For m = LBound(mcRLS, 1) To UBound(mcRLS, 1)
            If clist(i, 11) = mcRLS(m, 1) Then
                For j = LBound(clist, 1) To UBound(clist, 1)
'                    If clist(i, 8) = clist(j, 8) And clist(j, 31) = "Y" Then
'                        For n = 3 To UBound(mcRLS, 2)
'                            If clist(j, 11) = mcRLS(m, n) Then
'                                cnt = cnt + 1
'                                ReDim Preserve result(1 To 4, 1 To cnt)
'                                result(1, cnt) = clist(i, 2)
'                                result(2, cnt) = clist(j, 2)
'                                result(3, cnt) = "FS"
'                                result(4, cnt) = 0
'                            End If
'                        Next
'                    End If
                    If Left(clist(i, 8), 10) = Left(clist(j, 8), 10) And clist(j, 31) = "Y" Then
                        If Right(clist(j, 8), 2) = "00" And clist(j, 11) = "PI01" Then
                            For n = 3 To UBound(mcRLS, 2)
                                If clist(j, 11) = mcRLS(m, n) Then
                                    cnt = cnt + 1
                                    ReDim Preserve result(1 To 4, 1 To cnt)
                                    result(1, cnt) = clist(i, 2)
                                    result(2, cnt) = clist(j, 2)
                                    result(3, cnt) = "FS"
                                    result(4, cnt) = 0
                                End If
                            Next
                        End If
                    End If
                Next
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
Sheets("Standard Relation & Duration").Range("a4").Resize(UBound(result, 1), UBound(result, 2)) = result
End Sub


Sub ChangePDurationandPCRLS()

Dim plist, clist, result


With Sheets("Activity List (P)")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 15
    plist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With

With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 12
    clist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With

ReDim result(1 To 4, 1 To 1)

For i = LBound(plist, 1) To UBound(plist, 1)
    If plist(i, 13) = "Y" Then
        For j = LBound(clist, 1) To UBound(clist, 1)
            If plist(i, 12) = clist(j, 12) And plist(i, 11) = clist(j, 11) Then
                cnt = cnt + 1
                ReDim Preserve result(1 To 4, 1 To cnt)
                result(1, cnt) = plist(i, 2)
                result(2, cnt) = clist(j, 2)
                result(3, cnt) = "SS"
                If plist(i, 10) = "CI" Then
                    result(4, cnt) = 20
                ElseIf plist(i, 10) = "CS" Then
                    result(4, cnt) = 45
                ElseIf plist(i, 10) = "ME" Then
                    result(4, cnt) = 240
                ElseIf plist(i, 10) = "PI" Then
                    result(4, cnt) = 90
                ElseIf plist(i, 10) = "EL" Or plist(i, 10) = "IN" Then
                    result(4, cnt) = 150
                Else
                    result(4, cnt) = 60
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
Sheets("Standard Relation & Duration").Range("a4").Resize(UBound(result, 1), UBound(result, 2)) = result

End Sub






