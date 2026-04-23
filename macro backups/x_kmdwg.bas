Attribute VB_Name = "x_kmdwg"
Sub matchingDWGID()

Dim DWG, actList
Application.ScreenUpdating = False
Application.Calculation = xlCalculationManual
With Sheets("DWG")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    DWG = .Range(.Cells(4, 1), .Cells(irow, icol)).Value
    'keyinfo: subclass(3),facility(5),subtitle(6),CIA(8),documenttype(9),wkpkg(13,21)
    'keyinfo: discipline(4), markacode(7)
End With

Set d = CreateObject("scripting.dictionary")
For i = LBound(DWG, 1) To UBound(DWG, 1)
    If DWG(i, 3) = "DDD" And DWG(i, 9) = "DWG" Then
        temp1 = DWG(i, 8) & "-" & DWG(i, 5) & "-" & DWG(i, 6) & "-" & DWG(i, 4) & "-" & DWG(i, 7)
        temp2 = ""
        For j = 13 To UBound(DWG, 2)
            If DWG(i, j) <> "" Then
                If j = 13 Then
                    temp2 = DWG(i, j)
                Else
                    temp2 = temp2 & "@" & DWG(i, j)
                End If
            End If
        Next
        d(temp1 & "~" & temp2) = d(temp1 & "~" & temp2) + 1
    End If
Next
k = d.Keys
t = d.Items
ReDim temp(1 To UBound(k) + 1, 1 To 2)
For i = LBound(k) To UBound(k)
    temp(i + 1, 1) = Split(k(i), "~")(0)
    If InStr(1, Split(k(i), "~")(1), "@") > 0 Then
        tempstr = Split(Split(k(i), "~")(1), "@")
        temp(i + 1, 2) = tempstr
    Else
        temp(i + 1, 2) = Split(k(i), "~")(1)
    End If
Next
ReDim result(1 To 1, 1 To 1)
cnt = 0
For i = LBound(temp) To UBound(temp)
    If Left(Split(temp(i, 1), "-")(UBound(Split(temp(i, 1), "-"))), 2) = "KM" Then
        cnt = cnt + 1
        ReDim Preserve result(1 To 1, 1 To cnt)
        result(1, cnt) = temp(i, 1)
    End If
Next
ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
For i = LBound(result, 2) To UBound(result, 2)
    For j = LBound(result, 1) To UBound(result, 1)
        temp(i, j) = result(j, i)
    Next
Next
result = temp

Workbooks("Book1").Sheets("Sheet1").Range("a1").Resize(UBound(result, 1), 1) = result

End Sub
