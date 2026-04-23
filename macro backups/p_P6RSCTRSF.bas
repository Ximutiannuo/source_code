Attribute VB_Name = "p_P6RSCTRSF"
Sub Transfer_P6RSC_EXCEL()

With Sheets("P6_RSC_EXPORT")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    ReDim curvecnt(1 To 3, 1 To 3)
    For i = 1 To irow
        If .Range("a" & i) = "TYPE OF CURVE" Then
            cnt = cnt + 1
            curvecnt(cnt, 1) = i
            curvecnt(cnt, 2) = .Range("y" & i)
            curvecnt(cnt, 3) = .Cells(i, Columns.Count).End(xlToLeft).Column
        End If
        'plan 'forecast' actual
        

    Next
    plan = .Range("a" & curvecnt(1, 1) + 1 & ":" & "x" & curvecnt(2, 1) - 2).Value
    Forecast = .Range("a" & curvecnt(2, 1) + 1 & ":" & "x" & curvecnt(3, 1) - 2).Value
    actual = .Range("a" & curvecnt(3, 1) + 1 & ":" & "x" & irow).Value

    plan_data = .Range(.Cells(curvecnt(1, 1) + 1, 25), .Cells(curvecnt(2, 1) - 2, curvecnt(1, 3))).Value
    forecast_data = .Range(.Cells(curvecnt(2, 1) + 1, 25), .Cells(curvecnt(3, 1) - 2, curvecnt(2, 3))).Value
    actual_data = .Range(.Cells(curvecnt(3, 1) + 1, 25), .Cells(irow, curvecnt(3, 3))).Value



End With


With Sheets("Curves!")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    If irow > 1 Then
        .Range("a2:xfd" & irow).Clear
    End If
    irow = 1
    xx = irow + 1
    .Range("a" & irow + 1).Resize(UBound(plan, 1), UBound(plan, 2)) = plan
    
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    yy = irow + 1
    .Range("a" & irow + 1).Resize(UBound(Forecast, 1), UBound(Forecast, 2)) = Forecast
    
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    zz = irow + 1
    .Range("a" & irow + 1).Resize(UBound(actual, 1), UBound(actual, 2)) = actual

    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    For i = 25 To icol
        If .Cells(1, i) = curvecnt(1, 2) Then
            .Cells(xx, i).Resize(UBound(plan_data, 1), UBound(plan_data, 2)) = plan_data
        End If
        If .Cells(1, i) = curvecnt(2, 2) Then
            .Cells(yy, i).Resize(UBound(forecast_data, 1), UBound(forecast_data, 2)) = forecast_data
        End If
        If .Cells(1, i) = curvecnt(3, 2) Then
            .Cells(zz, i).Resize(UBound(actual_data, 1), UBound(actual_data, 2)) = actual_data
        End If
    Next
    

End With



End Sub
