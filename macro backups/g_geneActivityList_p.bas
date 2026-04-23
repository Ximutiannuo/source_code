Attribute VB_Name = "g_geneActivityList_p"
    Sub genActivityList_P()

Dim vdata, blockList, wkPKG, actList, rPRO, UniqueProCode

With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With

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

With Sheets("WorkSteps_P")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(3, Columns.Count).End(xlToLeft).Column
    rPRO = .Range(.Cells(4, 1), .Cells(irow, icol)).Value
End With
cnt = 0

' 如果是UNIT，则只有0000-00000-00录入此类工作
' 如果是PKG. 则录入到具体的装置
' 循环
UniqueProCode = Array("0000-00001-00", "0000-00002-00", "0000-00003-00", "0000-00004-00", "0000-00005-00")

ReDim result(1 To UBound(vdata, 2), 1 To 1)
For i = LBound(blockList, 1) To UBound(blockList, 1)
'    For x = LBound(UniqueProCode) To UBound(UniqueProCode)
'        If blockList(i, 10) = UniqueProCode(x) Then
'            s = s + 1
'            Exit For
'        End If
'    Next
'    If s = 0 Then
    For j = LBound(rPRO, 1) To UBound(rPRO, 1)
        If rPRO(j, 6) = "Y" And rPRO(j, 7) = "PKG" Then
            For m = 8 To 10
                If Not IsEmpty(rPRO(j, m)) Then
                    cnt = cnt + 1
                    ReDim Preserve result(1 To UBound(vdata, 2), 1 To cnt)
                    result(3, cnt) = blockList(i, 11)
                    result(4, cnt) = blockList(i, 12)
                    result(5, cnt) = "PR"
                    result(6, cnt) = blockList(i, 13)
                    result(7, cnt) = blockList(i, 14)
                    result(8, cnt) = blockList(i, 10)
                    result(9, cnt) = "Delivery of " & rPRO(j, m) & " (" & rPRO(j, 4) & ")"
                    result(10, cnt) = rPRO(j, 1)
                    result(11, cnt) = rPRO(j, 3)
                End If
            Next
        End If
    Next
'    Else
'        For j = LBound(rPRO, 1) To UBound(rPRO, 1)
'            If rPRO(j, 6) = "Y" And rPRO(j, 7) = "UNIT" Then
'                For m = 8 To 10
'                    If Not IsEmpty(rPRO(j, m)) Then
'                        cnt = cnt + 1
'                        ReDim Preserve result(1 To UBound(vData, 2), 1 To cnt)
'                        result(3, cnt) = blockList(i, 11)
'                        result(4, cnt) = blockList(i, 12)
'                        result(5, cnt) = "PR"
'                        result(6, cnt) = blockList(i, 13)
'                        result(7, cnt) = blockList(i, 14)
'                        result(8, cnt) = blockList(i, 10)
'                        result(9, cnt) = "Delivery of " & rPRO(j, m) & " (" & rPRO(j, 4) & ")"
'                        result(10, cnt) = rPRO(j, 1)
'                        result(11, cnt) = rPRO(j, 3)
'                    End If
'                Next
'            End If
'        Next
'    End If
'    s = 0
Next

ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
For i = LBound(result, 2) To UBound(result, 2)
    For j = LBound(result, 1) To UBound(result, 1)
        temp(i, j) = result(j, i)
    Next
Next
result = temp

With Sheets("Activity List (P)")
    .Range("a6").Resize(UBound(result, 1), UBound(result, 2)) = result
End With


End Sub


Sub MatchDWGwithProcurement()

Dim actList, vdata, result, UniqueProCode

With Sheets("Activity List (P)")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With

With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    actList = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With
ReDim result(1 To UBound(vdata, 2), 1 To 1)
UniqueProCode = Array("0000-00001-00", "0000-00002-00", "0000-00003-00", "0000-00004-00", "0000-00005-00")
For i = LBound(vdata, 1) To UBound(vdata, 1)
'    For m = LBound(UniqueProCode) To UBound(UniqueProCode)
'        If vData(i, 8) = UniqueProCode(m) Then
'            s = s + 1
'        End If
'    Next
'    If s = 0 Then
    For j = LBound(actList, 1) To UBound(actList, 1)
        tempstrA = vdata(i, 7) & "-" & vdata(i, 8) & "-" & vdata(i, 10) & "-" & vdata(i, 11)
        tempstrB = actList(j, 7) & "-" & actList(j, 8) & "-" & actList(j, 10) & "-" & actList(j, 11)
        If tempstrA = tempstrB And Not IsEmpty(actList(j, 12)) Then
            cnt = cnt + 1
            match_cnt = match_cnt + 1
            ReDim Preserve result(1 To UBound(vdata, 2), 1 To cnt)
            For m = LBound(vdata, 2) To UBound(vdata, 2)
                If m = 9 Then
                    If UBound(Split(actList(j, 12), "-")) = 4 Then
                        result(m, cnt) = vdata(i, m) & "(" & Split(actList(j, 12), "-")(3) & "-" & Split(actList(j, 12), "-")(4) & ")"
                    End If
                ElseIf m = 12 Then
                    result(m, cnt) = actList(j, 12)
                Else
                    result(m, cnt) = vdata(i, m)
                End If
            Next
        End If
    Next
'    Else
'        For j = LBound(actList, 1) To UBound(actList, 1)
'            tempstrA = vData(i, 7) & "-" & "-" & vData(i, 10) & "-" & vData(i, 11)
'            tempstrB = actList(j, 7) & "-" & "-" & actList(j, 10) & "-" & actList(j, 11)
'            If tempstrA = tempstrB And Not IsEmpty(actList(j, 12)) Then
'                cnt = cnt + 1
'                match_cnt = match_cnt + 1
'                ReDim Preserve result(1 To UBound(vData, 2), 1 To cnt)
'                For m = LBound(vData, 2) To UBound(vData, 2)
'                    If m = 9 Then
'                        result(m, cnt) = "(" & Split(actList(j, 12), "-")(3) & "-" & Split(actList(j, 12), "-")(4) & ")" & vData(i, m)
'                    ElseIf m = 12 Then
'                        result(m, cnt) = actList(j, 12)
'                    Else
'                        result(m, cnt) = vData(i, m)
'                    End If
'                Next
'            End If
'        Next
'    End If
    If match_cnt = 0 Then
        cnt = cnt + 1
        ReDim Preserve result(1 To UBound(vdata, 2), 1 To cnt)
        For m = LBound(vdata, 2) To UBound(vdata, 2)
            result(m, cnt) = vdata(i, m)
        Next
    End If
    match_cnt = 0
Next
ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
For i = LBound(result, 2) To UBound(result, 2)
    For j = LBound(result, 1) To UBound(result, 1)
        temp(i, j) = result(j, i)
    Next
Next
result = temp
Sheets("Activity List (P)").Range("a6").Resize(UBound(result, 1), UBound(result, 2)) = result
End Sub
