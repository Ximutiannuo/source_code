Attribute VB_Name = "vv_3week"
Sub Export_3WK_MP()

With Sheets("MP")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(1, 1), .Cells(irow, icol)).Value
    
    currentDate = Date
    If Weekday(currentDate, vbMonday) = 5 Then
        StartDate = currentDate - Weekday(currentDate, vbFriday) - 6
        EndDate = currentDate
        numDays = EndDate - StartDate
        ReDim dateArray(1 To numDays) As Date
        
        For i = 1 To numDays
             dateArray(i) = StartDate + i - 1
        Next
    Else
        StartDate = currentDate - (Weekday(currentDate, vbFriday) - 1) '+6
        EndDate = currentDate
        numDays = EndDate - StartDate + 1
        ReDim dateArray(1 To numDays) As Date
        
        For i = 1 To numDays
             dateArray(i) = StartDate + i - 1
        Next
    End If


    ReDim vDataThisWeek(1 To UBound(vdata, 2), 1 To 1)
    For i = UBound(vdata, 1) To LBound(vdata, 1) Step -1
        For j = LBound(dateArray) To UBound(dateArray)
            If vdata(i, 1) = dateArray(j) Then
                cnt = cnt + 1
                ReDim Preserve vDataThisWeek(1 To UBound(vdata, 2), 1 To cnt)
                For m = LBound(vdata, 2) To UBound(vdata, 2)
                    vDataThisWeek(m, cnt) = vdata(i, m)
                Next
            End If
        Next
        If vdata(i, 1) < dateArray(1) Then
            Exit For
        End If
    Next
    ReDim temp(1 To UBound(vDataThisWeek, 2), 1 To UBound(vDataThisWeek, 1))
    For i = LBound(temp, 1) To UBound(temp, 1)
        For j = LBound(temp, 2) To UBound(temp, 2)
            temp(i, j) = vDataThisWeek(j, i)
        Next
    Next
    vdata = temp
    
End With

cnt = 0

Set fso = CreateObject("scripting.filesystemobject")

'fpath = "C:\Users\Frail\OneDrive\16.UIO\03.蒋晓娟\三周滚动计划执行\"
fpath = "C:\Users\Frail\OneDrive\16.UIO\03.蒋晓娟\三周滚动计划执行\"
Set fd = fso.GetFolder(fpath)

For Each subfd In fd.SubFolders
    If subfd.Name = "12施工十二队" Or subfd.Name = "15各施工队汇总" Then
    Else
        For Each fl In subfd.Files
            'Debug.Print subfd.Name
            'Debug.Print fl.Name
            Set wb = Workbooks.Open(fl.Path, False)
            With wb.Worksheets("三周滚动计划详表（日报）")
                If .AutoFilterMode = True And .FilterMode = True Then
                    .ShowAllData
                End If
                Application.Calculation = xlCalculationManual
                
                irow = .Cells(Rows.Count, 1).End(xlUp).Row
                For i = 1 To irow
                    If .Cells(i, 1).Value = "二、每日汇总（每日各专业完成情况）" Then
                        irow = i
                        Exit For
                    End If
                Next
                irow = .Cells(irow, 1).End(xlUp).Row
                icol = .Cells(2, Columns.Count).End(xlToLeft).Column
                wkdb = .Range(.Cells(1, 1), .Cells(irow, icol)).Value
                
                For i = LBound(vdata, 1) To UBound(vdata, 1)
                    For j = 8 To UBound(wkdb, 1) Step 6
                        If IsError(wkdb(j, 2)) Then
                        Else
                            If j = 8 Then
                                If vdata(i, 2) = wkdb(j, 2) And wkdb(j, 11) = "实际人力" Then
                                    For m = 12 To UBound(wkdb, 2)
                                        If vdata(i, 1) = wkdb(3, m) Then
                                            .Cells(j, m).Value = vdata(i, 5)
                                            .Cells(j + 1, m).Value = vdata(i, 6)
                                            Exit For
                                        End If
                                    Next
                                End If
                            Else
                                For x = 8 To j - 6 Step 6
                                    If Not IsError(wkdb(x, 2)) Then
                                        If wkdb(x, 2) = wkdb(j, 2) Then
                                            cnt = cnt + 1
                                            Exit For
                                        End If
                                    End If
                                Next
                                If cnt = 0 And vdata(i, 2) = wkdb(j, 2) And wkdb(j, 11) = "实际人力" Then
                                    For m = 12 To UBound(wkdb, 2)
                                        If vdata(i, 1) = wkdb(3, m) Then
                                            .Cells(j, m).Value = vdata(i, 5)
                                            .Cells(j + 1, m).Value = vdata(i, 6)
                                            Exit For
                                        End If
                                    Next
                                End If
                            End If
                        End If
                        cnt = 0
                    Next
                Next
                Application.Calculation = xlCalculationAutomatic
            End With
            wb.AutoSaveOn = True
            wb.Save
            Application.Wait (Now + TimeValue("0:00:10"))
            wb.Close False
        Next
    End If
Next
Export_3WK_VFACT
End Sub




Sub Export_3WK_VFACT()

With Sheets("VFACT")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(1, 1), .Cells(irow, icol)).Value
    
    currentDate = Date
    If Weekday(currentDate, vbMonday) = 5 Then
        StartDate = currentDate - Weekday(currentDate, vbFriday) - 6
        EndDate = currentDate
        numDays = EndDate - StartDate
        ReDim dateArray(1 To numDays) As Date
        
        For i = 1 To numDays
             dateArray(i) = StartDate + i - 1
        Next
    Else
        StartDate = currentDate - (Weekday(currentDate, vbFriday) - 1) '+6
        EndDate = currentDate
        numDays = EndDate - StartDate + 1
        ReDim dateArray(1 To numDays) As Date
        
        For i = 1 To numDays
             dateArray(i) = StartDate + i - 1
        Next
    End If


    ReDim vDataThisWeek(1 To UBound(vdata, 2), 1 To 1)
    For i = UBound(vdata, 1) To LBound(vdata, 1) Step -1
        For j = LBound(dateArray) To UBound(dateArray)
            If vdata(i, 1) = dateArray(j) Then
                cnt = cnt + 1
                ReDim Preserve vDataThisWeek(1 To UBound(vdata, 2), 1 To cnt)
                For m = LBound(vdata, 2) To UBound(vdata, 2)
                    vDataThisWeek(m, cnt) = vdata(i, m)
                Next
            End If
        Next
        If vdata(i, 1) < dateArray(1) Then
            Exit For
        End If
    Next
    ReDim temp(1 To UBound(vDataThisWeek, 2), 1 To UBound(vDataThisWeek, 1))
    For i = LBound(temp, 1) To UBound(temp, 1)
        For j = LBound(temp, 2) To UBound(temp, 2)
            temp(i, j) = vDataThisWeek(j, i)
        Next
    Next
    vdata = temp
    
End With

cnt = 0

Set fso = CreateObject("scripting.filesystemobject")

'fpath = "C:\Users\Frail\OneDrive\16.UIO\03.蒋晓娟\三周滚动计划执行\"
fpath = "C:\Users\Frail\OneDrive\16.UIO\03.蒋晓娟\三周滚动计划执行\"

Set fd = fso.GetFolder(fpath)

For Each subfd In fd.SubFolders
    If subfd.Name = "12施工十二队" Or subfd.Name = "15各施工队汇总" Then
    Else
        For Each fl In subfd.Files
            'Debug.Print subfd.Name
            'Debug.Print fl.Name
            Set wb = Workbooks.Open(fl.Path, False)
            With wb.Worksheets("三周滚动计划详表（日报）")
                If .AutoFilterMode = True And .FilterMode = True Then
                    .ShowAllData
                End If
                Application.Calculation = xlCalculationManual
                irow = .Cells(Rows.Count, 1).End(xlUp).Row
                For i = 1 To irow
                    If .Cells(i, 1).Value = "二、每日汇总（每日各专业完成情况）" Then
                        irow = i
                        Exit For
                    End If
                Next
                irow = .Cells(irow, 1).End(xlUp).Row
                icol = .Cells(2, Columns.Count).End(xlToLeft).Column
                wkdb = .Range(.Cells(1, 1), .Cells(irow, icol)).Value
                
                For i = LBound(vdata, 1) To UBound(vdata, 1)
                    For j = 7 To UBound(wkdb, 1) Step 6
                        If IsError(wkdb(j, 2)) Then
                        Else
                            If j = 7 Then
                                If vdata(i, 2) = wkdb(j, 2) And wkdb(j, 11) = "实际完成量" Then
                                    For m = 12 To UBound(wkdb, 2)
                                        If vdata(i, 1) = wkdb(3, m) Then
                                            .Cells(j, m).Value = vdata(i, 16)

                                            Exit For
                                        End If
                                    Next
                                End If
                            Else
                                For x = 7 To j - 6 Step 6
                                    If Not IsError(wkdb(x, 2)) Then
                                        If wkdb(x, 2) = wkdb(j, 2) Then
                                            cnt = cnt + 1
                                            Exit For
                                        End If
                                    End If
                                Next
                                If cnt = 0 And vdata(i, 2) = wkdb(j, 2) And wkdb(j, 11) = "实际完成量" Then
                                    For m = 12 To UBound(wkdb, 2)
                                        If vdata(i, 1) = wkdb(3, m) Then
                                            .Cells(j, m).Value = vdata(i, 16)

                                            Exit For
                                        End If
                                    Next
                                End If
                            End If
                        End If
                        cnt = 0
                    Next
                Next
            End With
            Application.Calculation = xlCalculationAutomatic
            wb.AutoSaveOn = True
            wb.Save
            Application.Wait (Now + TimeValue("0:00:10"))
            
            wb.Close True
        Next
    End If
Next

End Sub


