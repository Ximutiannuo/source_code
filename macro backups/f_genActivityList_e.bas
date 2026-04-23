Attribute VB_Name = "f_genActivityList_e"
Sub genActivityList_E()

Dim vdata, blockList, wkPKG, actList, rDWG
'facility list
With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With

With Sheets("DWG_E")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    rDWG = .Range(.Cells(4, 1), .Cells(irow, icol))
End With
cnt = 0

Set d = CreateObject("scripting.dictionary")
For i = LBound(rDWG, 1) To UBound(rDWG, 1)
    If rDWG(i, 2) <> "CANCELLED" And rDWG(i, 2) <> "SUPERSEDED" And rDWG(i, 5) = "DDD" Then
        If rDWG(i, 11) = "DWG" Or rDWG(i, 11) = "SPE" Or rDWG(i, 11) = "DSH" Or rDWG(i, 11) = "MTO" Or rDWG(i, 11) = "MRQ" Or rDWG(i, 11) = "SOW" Then
            tempstr = rDWG(i, 3) & "-" & rDWG(i, 4) & "-" & rDWG(i, 5) & "-" & rDWG(i, 6) & "-" & rDWG(i, 7) & "-" & rDWG(i, 8) & "-" & rDWG(i, 10) & "-" & rDWG(i, 9) & "-" & rDWG(i, 11)
            If Not d.Exists(tempstr) Then
                ReDim brr(1 To 3) 'brr(1) = IFR_finish, brr(2) = IFC_finish, brr(3) = AFC_finish
            Else
                brr = d(tempstr)
            End If
            If IsEmpty(brr(1)) Then
                brr(1) = rDWG(i, 28)
            Else
                If brr(1) < rDWG(i, 28) Then
                    brr(1) = rDWG(i, 28)
                End If
            End If
            
            If IsEmpty(brr(2)) Then
                brr(2) = rDWG(i, 37)
            Else
                If brr(2) < rDWG(i, 37) Then
                    brr(2) = rDWG(i, 37)
                End If
            End If
            If IsEmpty(brr(3)) Then
                If rDWG(i, 40) > 0 Then
                    If rDWG(i, 41) = "A" Or rDWG(i, 41) = "B" Or rDWG(i, 41) = "AC" Then
                        brr(3) = rDWG(i, 40)
                    End If
                End If
            End If
            d(tempstr) = brr
        End If
    End If
Next

k = d.Keys
t = d.Items

For i = LBound(t) To UBound(t)
    If IsEmpty(t(i)(3)) Then
        t(i)(3) = t(i)(2) + 15
    End If
Next


With Sheets("Activity List (E)")
    ReDim actList(1 To 28, 1 To 1)
    For i = LBound(t) To UBound(t)
        tempstr = Split(k(i), "-")(6) & "-" & Split(k(i), "-")(4) & "-" & Split(k(i), "-")(5) & "-" & Split(k(i), "-")(3) & "-" & Split(k(i), "-")(7)
        For j = LBound(vdata, 1) To UBound(vdata, 1)
            If tempstr = vdata(j, 12) Then
                For m = LBound(t(i)) To UBound(t(i))
                    cnt = cnt + 1
                    ReDim Preserve actList(1 To 28, 1 To cnt)
                    actList(3, cnt) = vdata(j, 3)
                    actList(4, cnt) = vdata(j, 4)
                    actList(5, cnt) = "EN"
                    actList(6, cnt) = vdata(j, 6)
                    actList(7, cnt) = vdata(j, 7)
                    actList(8, cnt) = vdata(j, 8)
                    If m = 1 Then
                        actList(9, cnt) = "(IFR)" & k(i)
                        actList(10, cnt) = t(i)(1)
                    ElseIf m = 2 Then
                        actList(9, cnt) = "(IFC)" & k(i)
                        actList(10, cnt) = t(i)(2)
                    ElseIf m = 3 Then
                        actList(9, cnt) = "(AFC)" & k(i)
                        actList(10, cnt) = t(i)(3)
                    End If
                    actList(11, cnt) = Split(k(i), "-")(3)
                    actList(12, cnt) = Split(k(i), "-")(7)
                Next
                Exit For
            End If
        Next
    Next

    ReDim temp(1 To UBound(actList, 2), 1 To UBound(actList, 1))
    For i = LBound(actList, 2) To UBound(actList, 2)
        For j = LBound(actList, 1) To UBound(actList, 1)
            temp(i, j) = actList(j, i)
        Next
    Next
    actList = temp
    '.Range("a6").Resize(UBound(actList, 1), UBound(actList, 2)) = actList
End With

End Sub

Sub updateDWG()

Dim vdata, blockList, wkPKG, actList, rDWG

With Sheets("DWG_E")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    rDWG = .Range(.Cells(4, 1), .Cells(irow, icol))
End With
cnt = 0


'increasing start date

Set d1 = CreateObject("scripting.dictionary")
For i = LBound(rDWG, 1) To UBound(rDWG, 1)
    If rDWG(i, 2) <> "CANCELLED" And rDWG(i, 2) <> "SUPERSEDED" And rDWG(i, 5) = "DDD" Then
        If rDWG(i, 11) = "DWG" Or rDWG(i, 11) = "SPE" Or rDWG(i, 11) = "DSH" Or rDWG(i, 11) = "MTO" Then  'Or rDWG(i, 11) = "MRQ" Or rDWG(i, 11) = "SOW"
            tempstr = rDWG(i, 3) & "-" & rDWG(i, 4) & "-" & rDWG(i, 5) & "-" & rDWG(i, 6) & "-" & rDWG(i, 7) & "-" & rDWG(i, 8) & "-" & rDWG(i, 10) & "-" & rDWG(i, 9) & "-" & rDWG(i, 11)
            If Not d1.Exists(tempstr) Then
                ReDim brr(1 To 5)
            Else
                brr = d1(tempstr)
            End If
            brr(1) = rDWG(i, 4)
            brr(2) = brr(2) + 1
            If rDWG(i, 32) > 0 Then
                brr(3) = brr(3) + 1
            End If
            If rDWG(i, 38) > 0 Then
                brr(4) = brr(4) + 1
            End If
            If rDWG(i, 40) > 0 And rDWG(i, 41) = "A" Then
                brr(5) = brr(5) + 1
            End If
            d1(tempstr) = brr
        End If
    End If
Next

k1 = d1.Keys
t1 = d1.Items


Set d = CreateObject("scripting.dictionary")
For i = LBound(rDWG, 1) To UBound(rDWG, 1)
    If rDWG(i, 2) <> "CANCELLED" And rDWG(i, 2) <> "SUPERSEDED" And rDWG(i, 5) = "DDD" Then
        If rDWG(i, 11) = "DWG" Or rDWG(i, 11) = "SPE" Or rDWG(i, 11) = "DSH" Or rDWG(i, 11) = "MTO" Then 'Or rDWG(i, 11) = "MRQ" Or rDWG(i, 11) = "SOW"
            tempstr = rDWG(i, 3) & "-" & rDWG(i, 4) & "-" & rDWG(i, 5) & "-" & rDWG(i, 6) & "-" & rDWG(i, 7) & "-" & rDWG(i, 8) & "-" & rDWG(i, 10) & "-" & rDWG(i, 9) & "-" & rDWG(i, 11)
            If Not d.Exists(tempstr) Then
                ReDim brr(1 To 6) 'brr(1) = IFR_start, brr(2) = IFC_start, brr(3) = start ,4-6 finish
            Else
                brr = d(tempstr)
            End If
            brr(1) = Min(brr(1), rDWG(i, 31))
            brr(4) = Max(brr(4), rDWG(i, 31))
            brr(2) = Min(brr(2), rDWG(i, 37))
            brr(5) = Max(brr(5), rDWG(i, 37))
            If rDWG(i, 40) > 0 And rDWG(i, 41) = "A" Then
                brr(3) = Min(brr(3), rDWG(i, 40))
            ElseIf rDWG(i, 40) > 0 And rDWG(i, 41) <> "A" Then
                brr(3) = Min(brr(3), rDWG(i, 40) + 15)
            ElseIf rDWG(i, 40) = 0 And rDWG(i, 38) > 0 Then
                brr(3) = Min(brr(3), rDWG(i, 38) + 30)
            ElseIf rDWG(i, 40) = 0 And rDWG(i, 38) = 0 Then
                brr(3) = Min(brr(3), rDWG(i, 37) + 30)
            End If


            If rDWG(i, 40) > 0 And rDWG(i, 41) = "A" Then
                brr(6) = Max(brr(6), rDWG(i, 40))
            ElseIf rDWG(i, 40) > 0 And rDWG(i, 41) <> "A" Then
                brr(6) = Max(brr(6), rDWG(i, 40) + 15)
            ElseIf rDWG(i, 40) = 0 And rDWG(i, 38) > 0 Then
                brr(6) = Max(brr(6), rDWG(i, 38) + 30)
            ElseIf rDWG(i, 40) = 0 And rDWG(i, 38) = 0 Then
                brr(6) = Max(brr(6), rDWG(i, 37) + 30)
            End If

            d(tempstr) = brr
        End If
    End If
Next

k = d.Keys
t = d.Items

Set d = Nothing
Set d1 = Nothing

'For i = LBound(t) To UBound(t)
'    If IsEmpty(t(i)(3)) Then
'        t(i)(3) = t(i)(2) + 15
'    End If
'Next



With Sheets("Activity List (E)")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
End With

ReDim newdwg(1 To UBound(vdata, 2), 1 To 1)

For i = LBound(t) To UBound(t)
    For m = 1 To 3
        cnt = cnt + 1
        ReDim Preserve newdwg(1 To UBound(vdata, 2), 1 To cnt)
        If m = 1 Then
            newdwg(9, cnt) = "(IFR)" & k(i)
            newdwg(16, cnt) = t1(i)(1)
            newdwg(29, cnt) = t(i)(1)
            newdwg(30, cnt) = t(i)(4)
            newdwg(33, cnt) = t1(i)(2)
            newdwg(34, cnt) = t1(i)(3)
        ElseIf m = 2 Then
            newdwg(9, cnt) = "(IFC)" & k(i)
            newdwg(16, cnt) = t1(i)(1)
            newdwg(29, cnt) = t(i)(2)
            newdwg(30, cnt) = t(i)(5)
            newdwg(33, cnt) = t1(i)(2)
            newdwg(34, cnt) = t1(i)(4)
        ElseIf m = 3 Then
            newdwg(9, cnt) = "(AFC)" & k(i)
            newdwg(16, cnt) = t1(i)(1)
            newdwg(29, cnt) = t(i)(3)
            newdwg(30, cnt) = t(i)(6)
            newdwg(33, cnt) = t1(i)(2)
            newdwg(34, cnt) = t1(i)(5)
        End If
    Next
Next

cnt = 0
ReDim missingitem(1 To 1)
With CreateObject("scripting.dictionary")

    For Each it In Application.Index(vdata, 0, 9)
        NewElement = .item(it)
    Next
    
    For i = LBound(newdwg, 2) To UBound(newdwg, 2)
        If Not .Exists(newdwg(9, i)) Then
            cnt = cnt + 1
            ReDim Preserve missingitem(1 To cnt)
            missingitem(cnt) = newdwg(9, i)
        End If
    Next

    If cnt = 0 Then
        MsgBox "there is no missing engineering activity list compared to the latest MDR."
    Else
        ReDim Preserve missingitem(1 To cnt)
    End If
End With

cnt = 0
ReDim DelItem(1 To 1)
With CreateObject("scripting.dictionary")
    For i = LBound(newdwg, 2) To UBound(newdwg, 2)
        DelElement = .item(newdwg(9, i))
    Next
    For Each it In Application.Index(vdata, 0, 9)
        If Not .Exists(it) Then
            cnt = cnt + 1
            ReDim Preserve DelItem(1 To cnt)
            DelItem(cnt) = it
        End If
    Next
End With

For i = LBound(DelItem) To UBound(DelItem)
    For j = LBound(vdata, 1) To UBound(vdata, 1)
        If DelItem(i) = vdata(j, 9) Then
            vdata(j, 31) = "DEL"
            Exit For
        End If
    If vdata(j, 31) <> "DEL" Then vdata(j, 31) = "Y"
    Next
Next


Sheets("Activity List (E)").Range("ae6").Resize(UBound(vdata, 1), 1) = Application.Index(vdata, 0, 31)


Set newdwgDict = CreateObject("scripting.dictionary")
For i = LBound(newdwg, 2) To UBound(newdwg, 2)
    newdwgDict(newdwg(9, i)) = i
Next

k_newdwg = newdwgDict.Keys
t_newdwg = newdwgDict.Items

'update dates & 'scope
For i = LBound(vdata, 1) To UBound(vdata, 1)
    If newdwgDict.Exists(vdata(i, 9)) Then
        j = newdwgDict(vdata(i, 9))

        vdata(i, 29) = newdwg(29, j)
        vdata(i, 30) = newdwg(30, j)
        vdata(i, 33) = newdwg(33, j)
        vdata(i, 34) = newdwg(34, j)
        vdata(i, 16) = newdwg(16, j)
        If Not vdata(i, 33) = 0 And Not vdata(i, 33) = "" Then
            vdata(i, 35) = Format(vdata(i, 34) / vdata(i, 33), "0.00%")
        End If
        vdata(i, 36) = vdata(i, 30) - vdata(i, 29) + 1
        If vdata(i, 31) <> "DEL" Then
            Select Case vdata(i, 4)
            Case "PEL"
                vdata(i, 39) = "PE000000000000EMM01"
            Case "ECU"
                vdata(i, 39) = "EC000000000000EMM01"
            Case "UIO"
                vdata(i, 39) = "UI000000000000EMM01"
            Case "TSF"
                vdata(i, 39) = "EX000000000000EMM01"
            Case Else
                vdata(i, 39) = "GE000000000000EMM01"
            End Select
           vdata(i, 40) = vdata(i, 2)
           vdata(i, 41) = "FF"
           vdata(i, 42) = "Not Started"
           vdata(i, 43) = "Not Started"
           vdata(i, 44) = vdata(i, 30) - DateSerial(2019, 10, 11) + 1
        End If

    End If
Next


Sheets("Activity List (E)").Range("a6").Resize(UBound(vdata, 1), UBound(vdata, 2)) = vdata
cnt = 0
With Sheets("Facility List")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    facList = .Range(.Cells(3, 1), .Cells(irow, icol)).Value
    ReDim blockList(1 To UBound(facList, 2), 1 To 1)
    For i = LBound(facList, 1) To UBound(facList, 1)
        If facList(i, 11) = "" Then
        Else
            cnt = cnt + 1
            ReDim Preserve blockList(1 To UBound(facList, 2), 1 To cnt)
            For j = LBound(facList, 2) To UBound(facList, 2)
                blockList(j, cnt) = CStr(facList(i, j))
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


With Sheets("Activity List (E)")
    cnt = 0
    ReDim actList(1 To UBound(vdata, 2), 1 To 1)
    If missingitem(1) <> Empty Then
        For i = LBound(missingitem) To UBound(missingitem)
            cnt = cnt + 1
            ReDim Preserve actList(1 To UBound(vdata, 2), 1 To cnt)
            
            actList(3, cnt) = "GCC"
            actList(5, cnt) = "EN"
            actList(8, cnt) = Split(missingitem(i), "-")(6) & "-" & Split(missingitem(i), "-")(4) & "-" & Split(missingitem(i), "-")(5) 'cia+title+subtitle
            For j = LBound(blockList, 1) To UBound(blockList, 1)
                If actList(8, cnt) = blockList(j, 10) Then
                    actList(4, cnt) = blockList(j, 12) 'subproject
                    actList(6, cnt) = blockList(j, 13) 'train
                    actList(7, cnt) = blockList(j, 14) 'unit
                    Exit For
                End If
            Next
            
            actList(9, cnt) = missingitem(i)
            actList(10, cnt) = "E_" & Split(missingitem(i), "-")(3)
            actList(11, cnt) = Split(missingitem(i), "-")(3)
            actList(12, cnt) = Split(missingitem(i), "-")(7)
            actList(13, cnt) = Split(missingitem(i), "-")(4) & "-" & Split(missingitem(i), "-")(5) & "-" & Split(missingitem(i), "-")(6)
            actList(14, cnt) = Split(missingitem(i), "-")(6) & "-" & Split(missingitem(i), "-")(4) & "-" & Split(missingitem(i), "-")(5)
            actList(15, cnt) = Split(missingitem(i), "-")(4) & "-" & Split(missingitem(i), "-")(5)
            actList(16, cnt) = Split(missingitem(i), "-")(1)
            If newdwgDict.Exists(missingitem(i)) Then
                j = newdwgDict(missingitem(i))
                actList(29, cnt) = newdwg(29, j)
                actList(30, cnt) = newdwg(30, j)
                actList(31, cnt) = "Y"
                actList(33, cnt) = newdwg(33, j)
                actList(34, cnt) = newdwg(34, j)
                actList(32, cnt) = Date
                If Not actList(33, cnt) = 0 And Not actList(33, cnt) = "" Then
                    actList(35, cnt) = Format(actList(34, cnt) / actList(33, cnt), "0.00%")
                End If
                actList(36, cnt) = actList(30, cnt) - actList(29, cnt) + 1
                If actList(31, cnt) <> "DEL" Then
                    Select Case actList(4, cnt)
                    Case "PEL"
                        actList(39, cnt) = "PE000000000000EMM01"
                    Case "ECU"
                        actList(39, cnt) = "EC000000000000EMM01"
                    Case "UIO"
                        actList(39, cnt) = "UI000000000000EMM01"
                    Case "TSF"
                        actList(39, cnt) = "EX000000000000EMM01"
                    Case Else
                        actList(39, cnt) = "GE000000000000EMM01"
                    End Select
                   actList(40, cnt) = actList(2, cnt) 'later need again
                   actList(41, cnt) = "FF"
                   actList(42, cnt) = "Not Started"
                   actList(43, cnt) = "Not Started"
                   actList(44, cnt) = actList(30, cnt) - DateSerial(2019, 10, 11) + 1
                End If
            End If
            actList(1, cnt) = actList(4, cnt) & "PRJ." & actList(5, cnt) & "." & actList(6, cnt) & "." & actList(7, cnt)
        Next
    
        ReDim temp(1 To UBound(actList, 2), 1 To UBound(actList, 1))
        For i = LBound(actList, 2) To UBound(actList, 2)
            For j = LBound(actList, 1) To UBound(actList, 1)
                temp(i, j) = actList(j, i)
            Next
        Next
        actList = temp
        irow = .Cells(Rows.Count, 1).End(xlUp).Row + 1
        .Range("a" & irow).Resize(UBound(actList, 1), UBound(actList, 2)) = actList
        irow = .Cells(Rows.Count, 1).End(xlUp).Row
        keyIDs = .Range(.Cells(6, 1), .Cells(irow, 16)).Value
        For i = LBound(keyIDs, 1) To UBound(keyIDs, 1)
            If IsEmpty(keyIDs(i, 2)) Then
                For j = LBound(keyIDs, 1) To i - 1
                    currentID = keyIDs(i, 7) & keyIDs(i, 5) & Mid(keyIDs(i, 8), 6, 5) & Right(keyIDs(i, 8), 2) & keyIDs(i, 10)
                    previousID = Left(keyIDs(j, 2), 16)
                    If currentID = previousID Then
                        snums = CLng(Right(keyIDs(j, 2), Len(keyIDs(j, 2)) - InStr(1, keyIDs(j, 2), "E_") - 3)) + 1
                        If maxnums > snums Then
                            maxnums = maxnums
                        Else
                            maxnums = snums
                        End If
                    End If
                Next
                If maxnums = 0 Then
                    keyIDs(i, 2) = keyIDs(j, 7) & keyIDs(j, 5) & Mid(keyIDs(j, 8), 6, 5) & Right(keyIDs(j, 8), 2) & keyIDs(j, 10) & "001"
                ElseIf maxnums < 1000 Then
                    keyIDs(i, 2) = keyIDs(j, 7) & keyIDs(j, 5) & Mid(keyIDs(j, 8), 6, 5) & Right(keyIDs(j, 8), 2) & keyIDs(j, 10) & Format(maxnums, "000")
                Else
                    keyIDs(i, 2) = keyIDs(j, 7) & keyIDs(j, 5) & Mid(keyIDs(j, 8), 6, 5) & Right(keyIDs(j, 8), 2) & keyIDs(j, 10) & Format(maxnums, "0000")
                End If
            End If
            maxnums = 0
        Next
        .Range("b6").Resize(UBound(keyIDs, 1), 1) = Application.Index(keyIDs, 0, 2)
        .Range("an6").Resize(UBound(keyIDs, 1), 1) = Application.Index(keyIDs, 0, 2)
    End If
End With

End Sub

Sub WriteENGtoP6()
With Sheets("Activity List (E)")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    actList = .Range("a6:ak" & irow).Value2
End With

ReDim temp(1 To UBound(actList, 1), 1 To 37)

Set d = CreateObject("scripting.dictionary")
For i = 1 To UBound(actList, 1)
    If Not actList(i, 4) = Empty Then
        tempstr = actList(i, 4)
        If Not d.Exists(tempstr) Then
            ReDim brr(1 To 37)
        Else
            brr = d(tempstr)
        End If
        For m = LBound(brr) To UBound(brr)
            If actList(i, m) <> "" Then
                brr(m) = brr(m) & "@" & actList(i, m)
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

fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\P6 Integrated\ToUpdateMPWF\"
Set fso = CreateObject("scripting.filesystemobject")
Set fd = fso.GetFolder(fpath)
For Each fl In fd.Files
    For i = LBound(k) To UBound(k)
        If fl.Name = "EN-" & k(i) & "PRJ-Activities.xlsx" Then
            Set wb = Workbooks.Open(fl.Path)
            wb.Sheets("TASK").Activate
            With ActiveSheet
                irow = Rows.Count
                .Rows(3 & ":" & irow).EntireRow.Delete
                icol = Columns.Count
                .Range(.Cells(1, 21), .Cells(1, icol)).EntireColumn.Delete
                .Range("a3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(2))
                'b
                .Range("c3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(1))
                .Range("d3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(3))
                .Range("e3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(4))
                .Range("f3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(5))
                .Range("g3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(6))
                .Range("h3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(7))
                .Range("i3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(8))
                .Range("j3").Resize(UBound(t(i)(1)) + 1, 1) = Empty
                .Range("k3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(10))
                .Range("l3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(9))
                .Range("m3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(16))
                .Range("n3").Resize(UBound(t(i)(1)) + 1, 1) = Empty
                .Range("o3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(30))
                .Range("p3").Resize(UBound(t(i)(1)) + 1, 1) = Empty
                ReDim actualDate(1 To UBound(t(i)(30)) + 1, 1 To 1)
                For m = LBound(actualDate, 1) To UBound(actualDate, 1)
                    If CDate(t(i)(30)(m - 1)) <= Date Then
                        actualDate(m, 1) = CDate(t(i)(30)(m - 1))
                    Else
                        actualDate(m, 1) = Empty
                    End If
                Next
                .Range("q3").Resize(UBound(actualDate, 1), 1) = actualDate
                .Range("r3").Resize(UBound(actualDate, 1), 1) = "Finish On or After"
                .Range("s3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(30))

                ReDim actStatus(1 To UBound(t(i)(30)) + 1, 1 To 1)
                For m = LBound(actStatus, 1) To UBound(actStatus, 1)
                    If CDate(t(i)(30)(m - 1)) <= Date Then
                        actStatus(m, 1) = "Completed"
                    Else
                        actStatus(m, 1) = "Not Started"
                    End If
                Next
                .Range("b3").Resize(UBound(actStatus, 1), 1) = actStatus
                .Range("n3").Resize(UBound(t(i)(1)) + 1, 4).NumberFormat = "yyyy/m/d"
                .Range("s3").Resize(UBound(t(i)(1)) + 1, 1).NumberFormat = "yyyy/m/d"
            End With
            wb.Close True
        End If
    Next
Next

End Sub

Function Min(a, b)
    If IsEmpty(a) Or a = 0 Then Min = b: Exit Function
    If IsEmpty(b) Or b = 0 Then Min = a: Exit Function
    If a < b Then Min = a Else Min = b
End Function

Function Max(a, b)
    If IsEmpty(a) Or a = 0 Then Max = b: Exit Function
    If IsEmpty(b) Or b = 0 Then Max = a: Exit Function
    If a > b Then Max = a Else Max = b
End Function
