Attribute VB_Name = "e_genWBSDictionary"
Sub CreateWBSDic()

Dim vdata, blockList, wkPKG, actList, basicWBS, PRWBS, ENWBS, MIWBS

Application.ScreenUpdating = False
Application.Calculation = xlCalculationManual
With Sheets("Basic WBS")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    basicWBS = .Range("a1:a" & irow)
End With

With Sheets("Procure. WBS Exp.")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    PRWBS = .Range("a3:g" & irow)
End With

With Sheets("Engineering Breakdown")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    ENWBS = .Range("a2:b" & irow)
End With

With Sheets("Milestone Breakdown")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    MIWBS = .Range("a2:b" & irow)
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

With Sheets("WorkSteps_C")
cnt = 0
ReDim wkPKG(1 To 4, 1 To 1)
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = 4
    vdata = .Range(.Cells(4, 1), .Cells(irow, icol)).Value
    For i = LBound(vdata, 1) To UBound(vdata, 1)
        If vdata(i, 1) <> "" Then
            cnt = cnt + 1
            ReDim Preserve wkPKG(1 To 4, 1 To cnt)
            For j = LBound(vdata, 2) To UBound(vdata, 2)
                wkPKG(j, cnt) = vdata(i, j)
            Next
        End If
    Next
    ReDim temp(1 To UBound(wkPKG, 2), 1 To UBound(wkPKG, 1))
    For i = LBound(wkPKG, 2) To UBound(wkPKG, 2)
        For j = LBound(wkPKG, 1) To UBound(wkPKG, 1)
            temp(i, j) = wkPKG(j, i)
        Next
    Next
    wkPKG = temp
End With
ReDim result(1 To cnt)
cnt = 0
For i = LBound(blockList, 1) To UBound(blockList, 1)
    cnt = cnt + 1
    ReDim Preserve result(1 To cnt)
    result(cnt) = blockList(i, 11) & "." & blockList(i, 12) & "." & "CT" & "." & blockList(i, 13) & "." & blockList(i, 14) & "." & blockList(i, 10)

    dis_cnt = cnt
    For m = LBound(wkPKG, 1) To UBound(wkPKG, 1)
        If m = 1 Then
            cnt = cnt + 1
            ReDim Preserve result(1 To cnt)
            result(cnt) = result(dis_cnt) & "." & wkPKG(m, 1)
        ElseIf wkPKG(m, 1) <> wkPKG(m - 1, 1) Then
            cnt = cnt + 1
            ReDim Preserve result(1 To cnt)
            result(cnt) = result(dis_cnt) & "." & wkPKG(m, 1)
        End If
        cnt = cnt + 1
        ReDim Preserve result(1 To cnt)
        result(cnt) = result(dis_cnt) & "." & wkPKG(m, 1) & "." & wkPKG(m, 3)
    Next
Next

Set d = CreateObject("scripting.dictionary")
For i = LBound(result) To UBound(result)
    d(result(i)) = ""
Next
k = d.Keys

For i = LBound(k) To UBound(k)
    tempstr = ""
    If UBound(Split(k(i), ".")) > 5 Then
        If Split(k(i), ".")(6) = "MM" Then
            For m = 0 To UBound(Split(k(i), "."))
                If m = 0 Then
                    tempstr = Split(k(i), ".")(m)
                ElseIf m = 2 Then
                    tempstr = tempstr & "." & "CM"
                Else
                    tempstr = tempstr & "." & Split(k(i), ".")(m)
                End If
            Next
            k(i) = tempstr
        End If
    End If
Next

ReDim tempRange(1 To 1)
cnt = 0
For i = LBound(k) To UBound(k)
    tempstr = ""
    If Split(k(i), ".")(UBound(Split(k(i), "."))) = "MM" Then
        cnt = cnt + 1
        ReDim Preserve tempRange(1 To cnt)
        For m = 0 To UBound(Split(k(i), ".")) - 1
            If m = 0 Then
                tempstr = Split(k(i), ".")(m)
            Else
                tempstr = tempstr & "." & Split(k(i), ".")(m)
            End If
        Next
        tempRange(cnt) = tempstr
        cnt = cnt + 1
        ReDim Preserve tempRange(1 To cnt)
        tempRange(cnt) = k(i)
    Else
        cnt = cnt + 1
        ReDim Preserve tempRange(1 To cnt)
        tempRange(cnt) = k(i)
    End If
Next

k = tempRange

UniqueProCode = Array("0000-00001-00", "0000-00002-00", "0000-00003-00", "0000-00004-00", "0000-00005-00")

ReDim k1(1 To UBound(k))
cnt = 0
For i = LBound(k) To UBound(k)
    If Left(Split(k(i), ".")(UBound(Split(k(i), "."))), 2) = "PC" Or Left(Split(k(i), ".")(UBound(Split(k(i), "."))), 2) = "MM" Then
    Else
    
        If UBound(Split(k(i), ".")) < 6 Then
            cnt = cnt + 1
            'ReDim Preserve k1(1 To cnt)
            k1(cnt) = k(i)
        Else
            For j = LBound(PRWBS, 1) To UBound(PRWBS, 1)
                If UBound(Split(k(i), ".")) = 6 And PRWBS(j, 1) = Split(k(i), ".")(UBound(Split(k(i), "."))) Then
                    cnt = cnt + 1
                    'ReDim Preserve k1(1 To cnt)
                    k1(cnt) = k(i)
                    Exit For
                End If
                If UBound(Split(k(i), ".")) = 7 And PRWBS(j, 3) = Split(k(i), ".")(UBound(Split(k(i), "."))) Then
                    If PRWBS(j, 7) = "PKG" Then
    '                    For m = LBound(UniqueProCode) To UBound(UniqueProCode)
    '                        If Split(k(i), ".")(5) = UniqueProCode(m) Then
    '                            pro_cnt = pro_cnt + 1
    '                            Exit For
    '                        End If
    '                    Next
    '                    If pro_cnt > 0 Then
    '
    '                    Else
                        cnt = cnt + 1
                            'ReDim Preserve k1(1 To cnt)
                        k1(cnt) = k(i)
    '                    End If
    '                Else
    '                    For m = LBound(UniqueProCode) To UBound(UniqueProCode)
    '                        If Split(k(i), ".")(5) = UniqueProCode(m) Then
    '                            pro_cnt = pro_cnt + 1
    '                            Exit For
    '                        End If
    '                    Next
    '                    If pro_cnt > 0 Then
    '                        cnt = cnt + 1
    '                        'ReDim Preserve k1(1 To cnt)
    '                        k1(cnt) = k(i)
    '                    Else
    '
    '                    End If
                    End If
                    pro_cnt = 0
                    Exit For
                End If
            Next
        End If
        If cnt > 1 Then
            If UBound(Split(k1(cnt), ".")) = 6 And UBound(Split(k1(cnt - 1), ".")) = 6 Then
                cnt = cnt - 1
                k1(cnt) = k(i)
            ElseIf UBound(Split(k1(cnt), ".")) = 5 And UBound(Split(k1(cnt - 1), ".")) = 5 Then
                cnt = cnt - 1
                k1(cnt) = k(i)
            End If
        End If
    End If
Next

Erase temp

ReDim temp_k(1 To 1)
cnt = 0
For i = LBound(k1) To UBound(k1)
    If Not IsEmpty(k1(i)) Then
        If Split(k1(i), ".")(2) = "CM" And UBound(Split(k1(i), ".")) = 5 Then
        Else
            cnt = cnt + 1
            ReDim Preserve temp_k(1 To cnt)
            temp_k(cnt) = k1(i)
        End If
    End If
Next
k1 = temp_k

For i = LBound(k1) To UBound(k1)
    tempstr = ""

    For m = 0 To UBound(Split(k1(i), "."))
        If m = 0 Then
            tempstr = Split(k1(i), ".")(m)
        ElseIf m = 2 Then
            tempstr = tempstr & "." & "PR"
        Else
            tempstr = tempstr & "." & Split(k1(i), ".")(m)
        End If
    Next
    k1(i) = tempstr

Next


tempstr = ""
ReDim result(1 To 250000)
cnt = 0
For i = LBound(basicWBS, 1) To UBound(basicWBS, 1)
    If InStr(1, basicWBS(i, 1), ".") = 0 Then
        cnt = cnt + 1
        'ReDim Preserve result(1 To cnt)
        result(cnt) = basicWBS(i, 1)
    ElseIf UBound(Split(basicWBS(i, 1), ".")) <> 4 Then
        cnt = cnt + 1
        'ReDim Preserve result(1 To cnt)
        result(cnt) = basicWBS(i, 1)
    ElseIf Split(basicWBS(i, 1), ".")(2) <> "CT" And Split(basicWBS(i, 1), ".")(2) <> "CM" And Split(basicWBS(i, 1), ".")(2) <> "PR" Then
        If Split(basicWBS(i, 1), ".")(2) = "MI" Then
            cnt = cnt + 1
            result(cnt) = basicWBS(i, 1)
            For j = LBound(MIWBS, 1) To UBound(MIWBS, 1)
                cnt = cnt + 1
                result(cnt) = basicWBS(i, 1) & "." & MIWBS(j, 1)
            Next
        End If
        If Split(basicWBS(i, 1), ".")(2) = "EN" Then
            cnt = cnt + 1
            result(cnt) = basicWBS(i, 1)
            For j = LBound(ENWBS, 1) To UBound(ENWBS, 1)
                cnt = cnt + 1
                result(cnt) = basicWBS(i, 1) & "." & ENWBS(j, 1)
            Next
        End If
    ElseIf Split(basicWBS(i, 1), ".")(2) = "PR" Then
        cnt = cnt + 1
        'ReDim Preserve result(1 To cnt)
        result(cnt) = basicWBS(i, 1)
        For j = LBound(k1) To UBound(k1)
            If InStr(1, k1(j), ".") > 0 Then
                If UBound(Split(k1(j), ".")) > 4 Then
                    tempstr = Split(k1(j), ".")(0) & "." & Split(k1(j), ".")(1) & "." & Split(k1(j), ".")(2) & "." & Split(k1(j), ".")(3) & "." & Split(k1(j), ".")(4)
                    If tempstr = basicWBS(i, 1) Then
                        cnt = cnt + 1
                        'ReDim Preserve result(1 To cnt)
                        result(cnt) = k1(j)
                    End If
                End If
            End If
        Next
    ElseIf Split(basicWBS(i, 1), ".")(2) = "CT" Then
        cnt = cnt + 1
        'ReDim Preserve result(1 To cnt)
        result(cnt) = basicWBS(i, 1)
        For j = LBound(k) To UBound(k)
            If InStr(1, k(j), ".") > 0 Then
                If UBound(Split(k(j), ".")) > 4 Then
                    tempstr = Split(k(j), ".")(0) & "." & Split(k(j), ".")(1) & "." & Split(k(j), ".")(2) & "." & Split(k(j), ".")(3) & "." & Split(k(j), ".")(4)
                    If tempstr = basicWBS(i, 1) Then
                        cnt = cnt + 1
                        'ReDim Preserve result(1 To cnt)
                        result(cnt) = k(j)
                    End If
                End If
            End If
        Next
    ElseIf Split(basicWBS(i, 1), ".")(2) = "CM" Then
        cnt = cnt + 1
        'ReDim Preserve result(1 To cnt)
        result(cnt) = basicWBS(i, 1)
        For j = LBound(k) To UBound(k)
            If InStr(1, k(j), ".") > 0 Then
                If UBound(Split(k(j), ".")) > 4 Then
                    tempstr = Split(k(j), ".")(0) & "." & Split(k(j), ".")(1) & "." & Split(k(j), ".")(2) & "." & Split(k(j), ".")(3) & "." & Split(k(j), ".")(4)
                    If tempstr = basicWBS(i, 1) Then
                        cnt = cnt + 1
                        'ReDim Preserve result(1 To cnt)
                        result(cnt) = k(j)
                    End If
                End If
            End If
        Next
    
    End If
Next


ReDim vdata(1 To UBound(result), 1 To 4)

WBSTable = Sheets("WBS Table").Range("a3:p1359")

For i = LBound(result) To UBound(result)
    If InStr(1, result(i), ".") = 0 Then
        vdata(i, 1) = "GCC"
        vdata(i, 2) = "GCC"
        vdata(i, 3) = "NA"
        vdata(i, 4) = "GCC Project"
    Else
        vdata(i, 1) = result(i)
        vdata(i, 2) = Split(result(i), ".")(UBound(Split(result(i), ".")))
        strlen = Len(vdata(i, 2)) + 1
        vdata(i, 3) = Left(result(i), Len(result(i)) - strlen)
        lv = UBound(Split(result(i), "."))
        For m = LBound(WBSTable, 1) To UBound(WBSTable, 1)
            If WBSTable(m, lv * 2 + 1) = vdata(i, 2) Then
                vdata(i, 4) = WBSTable(m, lv * 2 + 2)
                Exit For
            End If
            If UBound(Split(vdata(i, 1), ".")) = 5 Then
                If Split(vdata(i, 1), ".")(2) = "EN" Then
                    If WBSTable(m, (lv + 1) * 2 + 1) = vdata(i, 2) Then
                        vdata(i, 4) = WBSTable(m, (lv + 1) * 2 + 2)
                        Exit For
                    End If
                End If
            End If
        Next
    End If

Next

Sheets("WBS Dictionary").Range("c2").Resize(UBound(vdata, 1), UBound(vdata, 2)) = vdata
Application.ScreenUpdating = True
Application.Calculation = xlCalculationAutomatic
End Sub

