Attribute VB_Name = "d_matchDWG"
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

ReDim DWG(1 To 3, 1 To 1)
For i = LBound(temp, 1) To UBound(temp, 1)
    If VarType(temp(i, 2)) = vbString Then
        If temp(i, 2) = "" Then
        Else
            cnt = cnt + 1
            ReDim Preserve DWG(1 To 3, 1 To cnt)
            DWG(1, cnt) = Split(temp(i, 1), "-")(0) & "-" & Split(temp(i, 1), "-")(1) & "-" & Split(temp(i, 1), "-")(2)
            DWG(2, cnt) = Split(temp(i, 1), "-")(3) & "-" & Split(temp(i, 1), "-")(4)
            DWG(3, cnt) = temp(i, 2)
        End If
    Else
        For j = LBound(temp(i, 2)) To UBound(temp(i, 2))
            If temp(i, 2)(j) <> "" Then
                cnt = cnt + 1
                ReDim Preserve DWG(1 To 3, 1 To cnt)
                DWG(1, cnt) = Split(temp(i, 1), "-")(0) & "-" & Split(temp(i, 1), "-")(1) & "-" & Split(temp(i, 1), "-")(2)
                DWG(2, cnt) = Split(temp(i, 1), "-")(3) & "-" & Split(temp(i, 1), "-")(4)
                DWG(3, cnt) = temp(i, 2)(j)
            End If
        Next
    End If
Next

'ReDim sel(1 To UBound(DWG, 2))

subtitle = Array("01", "02", "03", "04", "05", "06", "07")
pkgcode = Array("IN02", "IN03", "IN04", "IN05", "IN06", "IN07", "IN08", "IN09", "IN10", "EL01", "EL05", "EL06", "EL07", "EL08", "EL09", "PI01", "PI02", "PI03", "PI04", "PI05", "PI06", "PI07", "PI09", "HV01", "HV02")


With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 15
    actList = .Range(.Cells(6, 1), .Cells(irow, icol)).Value
    ReDim result(1 To UBound(actList, 2), 1 To 1)
    cnt = 0
    For i = LBound(actList, 1) To UBound(actList, 1)
        If Split(actList(i, 8), "-")(2) = "00" Then
            For y = LBound(pkgcode) To UBound(pkgcode)
                If actList(i, 11) = pkgcode(y) Then
                    For m = LBound(DWG, 2) To UBound(DWG, 2)
                        'If sel(m) <> "Y" Then
                        For x = LBound(subtitle) To UBound(subtitle)
                            If Left(Split(actList(i, 8), "-")(0), 2) = Left(Split(DWG(1, m), "-")(0), 2) And _
                                Split(actList(i, 8), "-")(1) = Split(DWG(1, m), "-")(1) And _
                                subtitle(x) = Split(DWG(1, m), "-")(2) And actList(i, 11) = DWG(3, m) Then
                                cnt = cnt + 1
                                s = s + 1
                                'sel(m) = "Y"
                                ReDim Preserve result(1 To UBound(actList, 2), 1 To cnt)
                                For j = LBound(actList, 2) To UBound(actList, 2)
                                    If j <> 12 Then
                                        result(j, cnt) = actList(i, j)
                                    Else
                                        result(j, cnt) = DWG(1, m) & "-" & DWG(2, m)
                                    End If
                                Next
                            End If
                        Next
                        'End If
                    Next
                End If
            Next
        End If
        For m = LBound(DWG, 2) To UBound(DWG, 2)
            'If sel(m) <> "Y" Then
            If actList(i, 8) = DWG(1, m) And actList(i, 11) = DWG(3, m) Then
                'sel(m) = "Y"
                cnt = cnt + 1
                s = s + 1
                ReDim Preserve result(1 To UBound(actList, 2), 1 To cnt)
                For j = LBound(actList, 2) To UBound(actList, 2)
                    If j <> 12 Then
                        result(j, cnt) = actList(i, j)
                    Else
                        result(j, cnt) = DWG(1, m) & "-" & DWG(2, m)
                    End If
                Next
            End If
            'End If
        Next
        If s = 0 Then
            cnt = cnt + 1
            ReDim Preserve result(1 To UBound(actList, 2), 1 To cnt)
            For j = LBound(actList, 2) To UBound(actList, 2)
                result(j, cnt) = actList(i, j)
            Next
        End If
        s = 0
    Next
    ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
    For i = LBound(result, 2) To UBound(result, 2)
        For j = LBound(result, 1) To UBound(result, 1)
            temp(i, j) = result(j, i)
        Next
    Next
    result = temp
    .Range("a6").Resize(UBound(result, 1), UBound(result, 2)) = result
End With

Application.ScreenUpdating = True
Application.Calculation = xlCalculationAutomatic

End Sub

