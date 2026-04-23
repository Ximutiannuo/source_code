Attribute VB_Name = "m2_updateSchedule"
Sub UpdateScheduleP6()
startTime = Timer
With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    actList = .Range(.Cells(6, 1), .Cells(irow, icol))
End With


'3,5,6,10 project, team, name, id
ReDim temp(1 To UBound(actList, 1), 1 To icol)
Set dAct = CreateObject("scripting.dictionary")
For i = 1 To UBound(actList, 1)
    If actList(i, 3) <> "" And actList(i, 22) <> "" Then
        tempstr = actList(i, 2)
        If Not dAct.Exists(tempstr) Then
            ReDim brr(1 To icol)
        Else
            brr = dAct(tempstr)
        End If
        For m = LBound(brr) To UBound(brr)
            If actList(i, m) <> "" Then
                brr(m) = brr(m) & "@" & actList(i, m)
            Else
                brr(m) = brr(m) & "@" & " "
            End If
        Next
        dAct(tempstr) = brr
    End If
Next

k = dAct.Keys
t = dAct.Items
'Set d = Nothing
For i = LBound(t) To UBound(t)
    For j = LBound(t(i)) To UBound(t(i))
        Dim tempArray As Variant
        tempArray = Split(Right(t(i)(j), Len(t(i)(j)) - 1), "@")
        t(i)(j) = tempArray
    Next
Next
For i = LBound(t) To UBound(t)
    For j = LBound(t(i)) To UBound(t(i))
        If t(i)(j)(0) = " " Then
            t(i)(j)(0) = 0
        End If
    Next
Next

With Sheets("Activity List(O_WF)")
    actSPE = .ListObjects("OWF").DataBodyRange.Value
End With

Set d_spe = CreateObject("scripting.dictionary")

ReDim brr(1 To UBound(actSPE, 2))
For i = LBound(actSPE, 1) To UBound(actSPE, 1)
    If Not d_spe.Exists(actSPE(i, 3)) Then
        ReDim brr(1 To UBound(actSPE, 2))
    Else
        brr = d_spe(actSPE(i, 3))
    End If
    For m = LBound(brr) To UBound(brr)
        If actSPE(i, m) <> "" Then
            brr(m) = brr(m) & "@" & actSPE(i, m)
        Else
            brr(m) = brr(m) & "@" & 0
        End If
    Next
    d_spe(actSPE(i, 3)) = brr
Next


ReDim rsc(1 To 9, 1 To 1)
For i = LBound(k) To UBound(k)
    cnt = cnt + 1
    ReDim Preserve rsc(1 To 9, 1 To cnt)
    rsc(1, cnt) = "GCC_WF"
    rsc(2, cnt) = t(i)(2)(0)
    rsc(3, cnt) = ""
    rsc(4, cnt) = ""
    rsc(5, cnt) = ""
    rsc(6, cnt) = t(i)(25)(0) * 1 'baseline
    rsc(7, cnt) = t(i)(25)(0) * 1 'atcomp
    rsc(8, cnt) = t(i)(37)(0) * 1 'actual
    rsc(9, cnt) = t(i)(4)(0)
    
    cnt = cnt + 1
    ReDim Preserve rsc(1 To 9, 1 To cnt)
    rsc(1, cnt) = "GCC_MP"
    rsc(2, cnt) = t(i)(2)(0)
    rsc(3, cnt) = ""
    rsc(4, cnt) = ""
    rsc(5, cnt) = ""
    rsc(6, cnt) = t(i)(21)(0) * 1 'Original Budget
    rsc(7, cnt) = t(i)(21)(0) * 1 'Original Budget
    rsc(8, cnt) = t(i)(36)(0) * 1 'actual
    
    total_qty = t(i)(20)(0) * 1
    completed_qty = t(i)(35)(0) * 1
    
    total_mh = t(i)(21)(0) * 1
    completed_mh = t(i)(36)(0) * 1
    
    If rsc(6, cnt) * 1 > 0 Then
        If total_qty = 0 Then
            rsc(6, cnt) = total_mh
            rsc(7, cnt) = total_mh
        ElseIf completed_qty / total_qty = 0 Or total_qty > completed_qty Then
                rsc(6, cnt) = completed_mh + ((total_qty - completed_qty) / (total_qty / total_mh * 10)) * 10
                rsc(7, cnt) = completed_mh + ((total_qty - completed_qty) / (total_qty / total_mh * 10)) * 10
        ElseIf total_qty <= completed_qty Then
            If completed_mh > 0 Then
                rsc(6, cnt) = completed_mh
                rsc(7, cnt) = completed_mh
            Else
                rsc(6, cnt) = 0
                rsc(7, cnt) = 0
            End If
        Else
            rsc(6, cnt) = total_mh
            rsc(7, cnt) = total_mh
        End If
    Else
        rsc(6, cnt) = completed_mh
        rsc(7, cnt) = completed_mh
    End If
    
    If rsc(6, cnt) < 0 Then
        Debug.Print i
    End If
    rsc(9, cnt) = t(i)(4)(0)
    
    If t(i)(21)(0) <> "" Then
        cnt = cnt + 1
        ReDim Preserve rsc(1 To 9, 1 To cnt)
        rsc(1, cnt) = t(i)(22)(0)
        rsc(2, cnt) = t(i)(2)(0)
        rsc(3, cnt) = ""
        rsc(4, cnt) = ""
        rsc(5, cnt) = ""
        rsc(6, cnt) = t(i)(20)(0) * 1
        rsc(7, cnt) = t(i)(20)(0) * 1
        rsc(8, cnt) = t(i)(35)(0) * 1
        rsc(9, cnt) = t(i)(4)(0)
    End If
Next

For Each key In d_spe.Keys
    keyValue = d_spe(key) ' Get the key at index i

    cnt = cnt + 1
    ReDim Preserve rsc(1 To 9, 1 To cnt)
    rsc(1, cnt) = "GCC_WF"
    rsc(2, cnt) = Split(keyValue(3), "@")(1)
    rsc(3, cnt) = ""
    rsc(4, cnt) = ""
    rsc(5, cnt) = ""
    rsc(6, cnt) = Split(keyValue(29), "@")(1) * 1 'baseline
    rsc(7, cnt) = Split(keyValue(29), "@")(1) * 1 'atcomp
    rsc(8, cnt) = Split(keyValue(30), "@")(1) * 1 'actual
    rsc(9, cnt) = Split(keyValue(8), "@")(1)
Next



Set d = CreateObject("scripting.dictionary")

For i = LBound(rsc, 2) To UBound(rsc, 2)
    tempstr = rsc(9, i)
    
    If Not d.Exists(tempstr) Then
        ReDim brr(1 To 8)
    Else
        brr = d(tempstr)
    End If
    For m = LBound(brr) To UBound(brr)
        If rsc(m, i) <> "" Then
            brr(m) = brr(m) & "@" & rsc(m, i)
        Else
            brr(m) = brr(m) & "@" & " "
        End If
    Next
    d(tempstr) = brr
Next

k = d.Keys
t = d.Items
Set tempArray = Nothing
'Set d = Nothing
For i = LBound(t) To UBound(t)
    For j = LBound(t(i)) To UBound(t(i))
        tempArray = Split(Right(t(i)(j), Len(t(i)(j)) - 1), "@")
        t(i)(j) = tempArray
    Next
Next

With Sheets("Activity List( from TEAMs)")
    actTimechange = .ListObjects("Construction_Teams").DataBodyRange.Value
End With

Set d1 = CreateObject("scripting.dictionary")

ReDim brr(1 To 8)
For i = LBound(actTimechange, 1) To UBound(actTimechange, 1)
    If Not d1.Exists(actTimechange(i, 2)) Then
        ReDim brr(1 To 11)
    Else
        brr = d1(actTimechange(i, 2))
    End If
    For m = LBound(brr) To UBound(brr)
        If actTimechange(i, m + 2) <> "" Then
            brr(m) = brr(m) & "@" & actTimechange(i, m + 2)
        Else
            brr(m) = brr(m) & "@" & 0
        End If
    Next
    d1(actTimechange(i, 2)) = brr
Next

'k1 = d1.keys
't1 = d1.Items
'
'For i = LBound(t1) To UBound(t1)
'    For j = LBound(t1(i)) To UBound(t1(i))
'        tempArray = Split(Right(t1(i)(j), Len(t1(i)(j)) - 1), "@")
'        t1(i)(j) = tempArray
'    Next
'Next



fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\P6 Integrated\ToUpdateMPWF\"



Set fso = CreateObject("scripting.filesystemobject")
Set fd = fso.GetFolder(fpath)
For Each fl In fd.Files
    For i = LBound(k) To UBound(k)
        If fl.Name = k(i) & "PRJ.xlsx" Then
            Set wb = Workbooks.Open(fl.Path)
            wb.Sheets("TASKRSRC").Activate
            With ActiveSheet
                irow = Rows.Count
                .Rows(3 & ":" & irow).EntireRow.Delete
                icol = Columns.Count
                .Range(.Cells(1, 10), .Cells(1, icol)).EntireColumn.Delete
                .Range("a3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(1))
                .Range("b3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(2))
                .Range("f3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(6))
                .Range("g3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(7))
                .Range("h3").Resize(UBound(t(i)(1)) + 1, 1) = Application.Transpose(t(i)(8))
                .Range("f3").Resize(UBound(t(i)(1)) + 1, 3).NumberFormat = "0.00"
            End With
            With wb.Sheets("TASK")
                .Activate
                irow = .Cells(Rows.Count, 1).End(xlUp).Row
                ReDim tempresult(1 To irow - 2, 1 To 4)
                tempresult = .Range("a3:d" & irow).Value
                ReDim Preserve tempresult(1 To UBound(tempresult, 1), 1 To 10)
                For j = LBound(tempresult, 1) To UBound(tempresult, 1)

                    If d1.Exists(tempresult(j, 1)) Then
                        dictItems = d1(tempresult(j, 1))
                        For m = LBound(dictItems) To UBound(dictItems)
                            dictItems(m) = Split(dictItems(m), "@")(1)
                            If dictItems(m) = 0 Or dictItems(m) = " " Then
                                dictItems(m) = Empty
                            Else
                                If VarType(dictItems(m)) = vbString Then
                                Else
                                    dictItems(m) = CDate(dictItems(m))
                                End If
                            End If
                        Next

                        If (dictItems(4) > 0 And dictItems(4) <> Empty) Or (dictItems(2) > 0 And dictItems(2) <> Empty) Then
                            tempresult(j, 5) = "Start On or After"
                        Else
                            tempresult(j, 5) = Empty
                        End If
                        
                        
                        
                        
                        'tempresult(j, 6) = dictItems(1) 'bl start
                        'tempresult(j, 7) = dictItems(2) 'bl finish
                        
                        
                        'change from the baseline to forecast
                        
                        tempresult(j, 6) = dictItems(4) 'forecast start
                        tempresult(j, 7) = dictItems(5) 'forecast finish
                        
                        'if there is no forecast dates then
                        If tempresult(j, 6) = 0 Or tempresult(j, 6) = Empty Then
                            tempresult(j, 6) = dictItems(2)
                        End If
                        If tempresult(j, 7) = 0 Or tempresult(j, 7) = Empty Then
                            tempresult(j, 7) = dictItems(3)
                        End If
                        
                        
                        tempresult(j, 8) = dictItems(6) 'actual start
                        tempresult(j, 9) = dictItems(7) 'actual finish

                        If (dictItems(6) > 0 And dictItems(6) <> Empty) And (dictItems(7) > 0 And dictItems(7) <> Empty) Then
                            tempresult(j, 2) = "Completed"
                        ElseIf (dictItems(6) > 0 And dictItems(6) <> Empty) And (dictItems(7) = 0 Or dictItems(7) = Empty) Then
                            tempresult(j, 2) = "In Progress"
                        Else
                            tempresult(j, 2) = "Not Started"
                        End If
                        If tempresult(j, 2) = "Completed" Then
                            tempresult(j, 6) = dictItems(6)
                            tempresult(j, 7) = dictItems(7)
                        ElseIf tempresult(j, 2) = "In Progress" Then
                            tempresult(j, 6) = dictItems(6)
                        Else
                        End If
                        
                    End If
                    If tempresult(j, 8) = Empty And dAct.Exists(tempresult(j, 1)) Then
                        tempAct = dAct(tempresult(j, 1))
                        If Split(tempAct(32), "@")(1) = " " Or Split(tempAct(32), "@")(1) = 0 Then
                            tempresult(j, 8) = Empty
                        Else
                            tempresult(j, 8) = CDate(Split(tempAct(32), "@")(1))
                        End If
                    End If
                    If tempresult(j, 9) = Empty And dAct.Exists(tempresult(j, 1)) And tempresult(j, 2) = "Completed" Then
                        tempAct = dAct(tempresult(j, 1))
                        If Split(tempAct(33), "@")(1) = " " Or Split(tempAct(33), "@")(1) = 0 Then
                            tempresult(j, 9) = Empty
                        Else
                            tempresult(j, 9) = CDate(Split(tempAct(33), "@")(1))
                        End If
                    End If
                    
                Next
                .Range("a3").Resize(UBound(tempresult, 1), UBound(tempresult, 2)) = tempresult
                .Range("f3:i" & irow).NumberFormat = "yyyy/m/d"

                For Each key In d_spe.Keys
                    keyValue = d_spe(key) ' Get the key at index i
                    
                    If Split(keyValue(8), "@")(1) = Left(wb.Name, 3) And CDate(Split(keyValue(33), "@")(1)) > 0 Then
                        irow = .Cells(Rows.Count, 1).End(xlUp).Row + 1
                        .Cells(irow, 1) = Split(keyValue(3), "@")(1)
                        If CDate(Split(keyValue(31), "@")(1)) > 0 And CDate(Split(keyValue(32), "@")(1)) Then
                            .Cells(irow, 2) = "Completed"
                        ElseIf CDate(Split(keyValue(31), "@")(1)) > 0 Then
                            .Cells(irow, 2) = "In Progress"
                        Else
                            .Cells(irow, 2) = "Not Started"
                        End If
                        .Cells(irow, 3) = Split(keyValue(5), "@")(1)
                        .Cells(irow, 4) = Split(keyValue(6), "@")(1)
                        .Cells(irow, 5) = "Start On or After"
                        .Cells(irow, 6) = CDate(Split(keyValue(33), "@")(1))
                        .Cells(irow, 7) = CDate(Split(keyValue(34), "@")(1))
                        .Cells(irow, 8) = CDate(Split(keyValue(31), "@")(1))
                        If CDate(Split(keyValue(32), "@")(1)) > 0 Then
                            .Cells(irow, 9) = CDate(Split(keyValue(32), "@")(1))
                        End If
                    End If
                Next
                .Range("f3:i" & irow).NumberFormat = "yyyy/m/d"
            End With
            
            With wb.Sheets("TASKPRED")
                .Activate
                Erase tempresult
                irow = .Cells(Rows.Count, 1).End(xlUp).Row
                If irow > 3 Then
                    tempresult = .Range("a3:g" & irow).Value
                    For j = LBound(tempresult, 1) To UBound(tempresult, 1)
                        If d1.Exists(tempresult(j, 1)) Then
                            dictItems = d1(tempresult(j, 1))
                            For m = LBound(dictItems) To UBound(dictItems)
                                dictItems(m) = Split(Right(dictItems(m), Len(dictItems(m)) - 1), "@")
                                On Error Resume Next
                                If dictItems(m)(0) = "0" Then
                                    dictItems(m)(0) = Empty
                                Else
                                    dictItems(m)(0) = CDate(dictItems(m)(0))
                                End If
                            Next m
                            If dictItems(5)(0) > 0 And dictItems(5)(0) <> Empty Then
                                tempresult(j, 7) = "d"
                            End If
                        End If
                    Next
                    .Range("a3").Resize(UBound(tempresult, 1), UBound(tempresult, 2)) = tempresult
                End If
            End With
            wb.Close True
        End If
    Next
Next

ElapsedTime = Timer - startTime
MsgBox "Step 4 Completed - Generated Updated RSC to P6! Elapsed Time: " & Format(ElapsedTime \ 60, "00") & ":" & Format(ElapsedTime Mod 60, "00") & "."

End Sub



