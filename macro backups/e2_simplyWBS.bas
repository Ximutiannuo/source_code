Attribute VB_Name = "e2_simplyWBS"
Sub CreateWBSDic()

Dim vdata, blockList, wkPKG, actList, basicWBS, PRWBS, ENWBS, MIWBS

Application.ScreenUpdating = False
Application.Calculation = xlCalculationManual
With Sheets("Basic WBS")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    basicWBS = .Range("a1:a" & irow)
End With

ReDim vdata(1 To UBound(basicWBS, 1), 1 To 4)

WBSTable = Sheets("WBS Table").Range("a3:p1359")

For i = LBound(basicWBS, 1) To UBound(basicWBS, 1)
    If InStr(1, basicWBS(i, 1), ".") = 0 Then
        vdata(i, 1) = "GCC"
        vdata(i, 2) = "GCC"
        vdata(i, 3) = "NA"
        vdata(i, 4) = "GCC Project"
    Else
        vdata(i, 1) = basicWBS(i, 1)
        vdata(i, 2) = Split(basicWBS(i, 1), ".")(UBound(Split(basicWBS(i, 1), ".")))
        strlen = Len(vdata(i, 2)) + 1
        vdata(i, 3) = Left(basicWBS(i, 1), Len(basicWBS(i, 1)) - strlen)
        lv = UBound(Split(basicWBS(i, 1), "."))
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


