Attribute VB_Name = "b_writeWBSDiagram"
Sub writeBlockintoWBS()
Dim vdata, blockList, unitMatch
With Sheets("Facility List")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(3, 1), .Cells(irow, icol)).Value
End With

With Sheets("WBS Diagram")
    unitMatch = .Range("t38:cq56")
End With

ReDim blockList(1 To 3, 1 To 1)
For j = LBound(unitMatch, 2) To UBound(unitMatch, 2)
    For i = LBound(unitMatch, 1) To UBound(unitMatch, 1)
        If unitMatch(i, j) <> "" Then
            For m = LBound(vdata, 1) To UBound(vdata, 1)
                If unitMatch(i, j) = vdata(m, 14) And vdata(m, 11) <> "" Then
                    cnt = cnt + 1
                    ReDim Preserve blockList(1 To 3, 1 To cnt)
                    blockList(1, cnt) = vdata(m, 14)
                    blockList(2, cnt) = vdata(m, 10)
                    blockList(3, cnt) = vdata(m, 16)
                End If
            Next
        End If
    Next
Next
cnt = 0
ReDim result(1 To 6)
ReDim temp(1 To 2, 1 To 1)
colIndex = Array(3, 16, 29, 42, 55, 68)

For j = LBound(unitMatch, 2) To UBound(unitMatch, 2)
    For n = LBound(colIndex) To UBound(colIndex)
        If j = colIndex(n) Then
            For i = LBound(unitMatch, 1) To UBound(unitMatch, 1)
                For m = LBound(blockList, 2) To UBound(blockList, 2)
                    If blockList(1, m) = unitMatch(i, j) Then
                        cnt = cnt + 1
                        ReDim Preserve temp(1 To 2, 1 To cnt)
                        temp(1, cnt) = blockList(2, m)
                        temp(2, cnt) = blockList(3, m)
                    End If
                Next
            Next
            result(n + 1) = temp
            ReDim temp(1 To 2, 1 To 1)
            cnt = 0
        End If
    Next
Next
Application.Calculation = xlCalculationManual

For i = LBound(result) To UBound(result)
    For m = LBound(result(i), 2) To UBound(result(i), 2)
        Sheets("WBS Diagram").Cells(57 + m * 3, 19 + colIndex(i - 1) - 2).Value = result(i)(1, m)
        Sheets("WBS Diagram").Cells(57 + m * 3, 19 + colIndex(i - 1) - 2).Font.Size = 6
        Sheets("WBS Diagram").Cells(57 + m * 3, 19 + colIndex(i - 1) - 2).Font.Name = "Arial"
        Sheets("WBS Diagram").Cells(57 + m * 3, 19 + colIndex(i - 1) + 1).Value = result(i)(2, m)
        Sheets("WBS Diagram").Cells(57 + m * 3, 19 + colIndex(i - 1) + 1).Font.Size = 7
        Sheets("WBS Diagram").Cells(57 + m * 3, 19 + colIndex(i - 1) + 1).Font.Name = "Arial"
        Sheets("WBS Diagram").Range(Cells(57 + m * 3, 19 + colIndex(i - 1) - 2), Cells(57 + m * 3, 19 + colIndex(i - 1))).Borders(xlEdgeBottom).LineStyle = xlContinuous
        Sheets("WBS Diagram").Range(Cells(57 + m * 3 - 2, 19 + colIndex(i - 1) - 2), Cells(57 + m * 3, 19 + colIndex(i - 1) - 2)).Borders(xlEdgeLeft).LineStyle = xlContinuous
        Sheets("WBS Diagram").Range(Cells(57 + m * 3, 19 + colIndex(i - 1) + 1), Cells(56 + m * 3 + 2, 19 + colIndex(i - 1) + 8)).Merge
        Sheets("WBS Diagram").Range(Cells(57 + m * 3, 19 + colIndex(i - 1) + 1), Cells(56 + m * 3 + 2, 19 + colIndex(i - 1) + 8)).HorizontalAlignment = xlLeft
        Sheets("WBS Diagram").Range(Cells(57 + m * 3, 19 + colIndex(i - 1) + 1), Cells(56 + m * 3 + 2, 19 + colIndex(i - 1) + 8)).VerticalAlignment = xlCenter
        Sheets("WBS Diagram").Range(Cells(57 + m * 3, 19 + colIndex(i - 1) + 1), Cells(56 + m * 3 + 2, 19 + colIndex(i - 1) + 8)).WrapText = True
        Sheets("WBS Diagram").Range(Cells(57 + m * 3, 19 + colIndex(i - 1) + 1), Cells(56 + m * 3 + 2, 19 + colIndex(i - 1) + 8)).Borders.LineStyle = xlContinuous
        Sheets("WBS Diagram").Range(Cells(57 + m * 3, 19 + colIndex(i - 1) + 1), Cells(56 + m * 3 + 2, 19 + colIndex(i - 1) + 8)).Interior.Color = RGB(255, 230, 153)
        Sheets("WBS Diagram").Range(Cells(57 + m * 3, 19 + colIndex(i - 1) + 1), Cells(56 + m * 3 + 2, 19 + colIndex(i - 1) + 8)).EntireRow.RowHeight = 12
    Next
Next
Application.Calculation = xlCalculationAutomatic

End Sub

