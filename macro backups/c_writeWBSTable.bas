Attribute VB_Name = "c_writeWBSTable"
Sub convertWBSTable()

Dim vdata, Stage

With Sheets("WBS Diagram")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = 95
    vdata = .Range(.Cells(9, 1), .Cells(irow, icol)).Value
End With

Stage = Array("Project", "Sub-project", "Phase", "Train", "Unit", "Block", "Discipline")
ReDim result(1 To 7)
ReDim temp(1 To 3, 1 To 1)

For m = LBound(Stage) To UBound(Stage)
    For i = LBound(vdata, 1) To UBound(vdata, 1)
        If vdata(i, 3) = Stage(m) Then
            For j = 4 To UBound(vdata, 2)
                If vdata(i, j) <> "" And m < 5 Then
                    cnt = cnt + 1
                    ReDim Preserve temp(1 To 3, 1 To cnt)
                    temp(1, cnt) = vdata(i, j)
                    temp(2, cnt) = vdata(i + 1, j)
                    temp(3, cnt) = j
                ElseIf vdata(i, j) <> "" And m = 5 Then
                    If (j + 6) Mod 13 = 0 Then
                        cnt = cnt + 1
                        ReDim Preserve temp(1 To 3, 1 To cnt)
                        temp(1, cnt) = vdata(i, j)
                        temp(2, cnt) = vdata(i, j + 3)
                        temp(3, cnt) = j
                    End If
                ElseIf vdata(i, j) <> "" And m = 6 Then
                    If (j + 1) Mod 9 = 0 Then
                        cnt = cnt + 1
                        ReDim Preserve temp(1 To 3, 1 To cnt)
                        temp(1, cnt) = vdata(i, j)
                        temp(2, cnt) = vdata(i, j + 1)
                        temp(3, cnt) = j
                    End If
                End If
            Next
        End If
    Next
    result(m + 1) = temp
    cnt = 0
Next
Application.Calculation = xlCalculationManual
With Sheets("WBS Table")
    For i = LBound(result, 1) To UBound(result, 1)
        For m = LBound(result(i), 1) To UBound(result(i), 1) - 1
            For n = LBound(result(i), 2) To UBound(result(i), 2)
                .Cells(n + 2, 1 + (i - 1) * 2 + m - 1) = result(i)(m, n)
            Next
        Next
    Next
End With
Application.Calculation = xlCalculationAutomatic


End Sub





Sub convertWBSdict()





End Sub
