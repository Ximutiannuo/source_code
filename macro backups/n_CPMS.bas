Attribute VB_Name = "n_CPMS"
Sub CPMS()
Dim i, j, xl, yl, m, n, p, z
Dim code1, code2, workstep, wkp, arr, brr
Dim d, t, k, at
Dim actid, actdes, ew, unit, block, disp, wgp, data, vdata
'/关闭屏幕刷新，关闭自动计算/
'Application.ScreenUpdating = False
'Application.Calculation = xlCalculationManual


'/获取值/
Sheets("WorkSteps_C").Activate
With ActiveSheet
    xl = .Cells(Rows.Count, 2).End(xlUp).Row
    code1 = .Range("A4:A" & xl)
    code2 = .Range("C4:C" & xl)
    workstep = .Range("D4:D" & xl)

    ReDim wkp(1 To UBound(code2, 1))
    For i = LBound(code2, 1) To UBound(code2, 1) Step 2
        yl = .Cells(i + 3, Columns.Count).End(xlToLeft).Column
        If yl > 19 Then
            ReDim arr(1 To yl - 19, 1 To 4)
            For j = LBound(arr, 1) To UBound(arr, 1)
                arr(j, 1) = .Cells(i + 3, 19 + j)
                arr(j, 2) = .Cells(i + 4, 19 + j) / 100
                If .Cells(i + 3, 19 + j).Interior.Color = RGB(221, 235, 247) Then
                    arr(j, 3) = "KEYQTY"
                    mm = mm + 1
                End If
            Next
            If mm > 1 Then
                For j = LBound(arr, 1) To UBound(arr, 1)
                    arr(j, 4) = "MULTI"
                Next
            Else
                For j = LBound(arr, 1) To UBound(arr, 1)
                    arr(j, 4) = "UNIQUE"
                Next
            End If
            wkp(i) = arr
            mm = 0
            Erase arr
        End If
    Next
End With

''/字典去除code1中重复专业/
'Set d = CreateObject("scripting.dictionary")
'For i = 1 To UBound(code1, 1)
'    If code1(i, 1) <> "" And code1(i, 1) <> "PC" Then
'        d(code1(i, 1)) = d(code1(i, 1)) + 1
'    End If
'Next
'
'k = d.keys
't = d.items

'/按照专业添加sheet表/


'/取/
Sheets("Activity List").Activate
With ActiveSheet
    xl = .Cells(Rows.Count, 1).End(xlUp).Row
    vdata = .Range(.Cells(6, 1), .Cells(xl, 31))
End With

Sheets("DB").Activate
ReDim result(1 To 24, 1 To 1)
For i = LBound(vdata, 1) To UBound(vdata, 1)
    For j = LBound(code1, 1) To UBound(code1, 1)
        If vdata(i, 10) <> "PC" And vdata(i, 10) <> "MM" Then
            If vdata(i, 11) = code2(j, 1) Then
                cnt = cnt + 1
                ReDim Preserve result(1 To 24, 1 To cnt)
                For m = LBound(vdata, 2) To 22
                    result(m, cnt) = vdata(i, m)
                Next
                cs = cnt
                cnt = cnt + UBound(wkp(j))
                ReDim Preserve result(1 To 24, 1 To cnt)
                For n = 1 To UBound(wkp(j))
                    For m = LBound(vdata, 2) To 22
                        If m = 14 Or m = 18 Then
                            If wkp(j)(n, 3) = "KEYQTY" Then
                                result(m, cs + n) = vdata(i, m)
                            End If
                        ElseIf m = 15 Then
                            If wkp(j)(n, 4) = "UNIQUE" Then
                                If wkp(j)(n, 3) = "KEYQTY" Then
                                    result(m, cs + n) = vdata(i, m)
                                End If
                            Else
                                If wkp(j)(n, 3) = "KEYQTY" Then
                                    result(m, cs + n) = vdata(i, m) * wkp(j)(n, 2) / 0.95
                                End If
                            End If
                        ElseIf m = 17 Or m = 19 Or m = 20 Or m = 21 Then
                            result(m, cs + n) = vdata(i, m) * wkp(j)(n, 2)
                        Else
                            result(m, cs + n) = vdata(i, m)
                        End If
                    Next
                    result(9, cs + n) = wkp(j)(n, 1)
                    result(23, cs + n) = wkp(j)(n, 2)
                Next
            End If
        End If
    Next
Next

ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
For i = LBound(temp, 2) To UBound(temp, 2)
    For j = LBound(temp, 1) To UBound(temp, 1)
        temp(j, i) = result(i, j)
    Next
Next

result = temp
Sheets("DB").Range("A2").Resize(UBound(result, 1), UBound(result, 2)) = result

'/打开屏幕刷新，打开自动计算/
Application.ScreenUpdating = False
Application.Calculation = xlCalculationAutomatic
End Sub

