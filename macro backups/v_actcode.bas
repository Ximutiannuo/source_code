Attribute VB_Name = "v_actcode"
Sub addactivitycode()

ReDim arr(1 To 24, 1 To 1)

shname = "Activity List"
For Each sh In ThisWorkbook.Sheets
    If Left(sh.Name, 13) = shname Then
        Debug.Print sh.Name
        With Sheets(sh.Name)
            irow = .Cells(Rows.Count, 2).End(xlUp).Row
            temp = .Range("a6:x" & irow)
            For i = LBound(temp, 1) To UBound(temp, 1)
                cnt = cnt + 1
                ReDim Preserve arr(1 To UBound(temp, 2), 1 To cnt)
                For j = LBound(temp, 2) To UBound(temp, 2)
                    arr(j, cnt) = temp(i, j)
                Next
            Next
        End With
    End If
Next

'fpath = "C:\Users\Xie Guangjie\Documents\P6 Document\"
fpath = "C:\Users\Frail\Documents\P6 Document\"
Set fso = CreateObject("scripting.filesystemobject")

Set fd = fso.GetFolder(fpath)


For Each fl In fd.Files
    Set wb = Workbooks.Open(fl.Path)
    With wb.ActiveSheet
        irow = .Cells(Rows.Count, 1).End(xlUp).Row
        If irow = 2 Then
            wb.Close False
        Else
            act = .Range("a3:d" & irow)
            '.Range("a3:d" & irow).Clear
            For i = LBound(act, 1) To UBound(act, 1)
                For j = LBound(arr, 2) To UBound(arr, 2)
                    If act(i, 1) = arr(2, j) Then
                        act(i, 4) = arr(23, j)
                    End If
                Next
            Next
            .Range("a3").Resize(UBound(act, 1), UBound(act, 2)) = act
            wb.Close True
        End If
    End With
    
Next


End Sub


Sub changeactnamex()


'fpath = "C:\Users\Frail\Documents\Activity Code Add\"
'fpath = "C:\Users\Frail\Documents\Activity Code Add\"
Set fso = CreateObject("scripting.filesystemobject")

Set fd = fso.GetFolder(fpath)


For Each fl In fd.Files
    Set wb = Workbooks.Open(fl.Path)
    With wb.ActiveSheet
        irow = .Cells(Rows.Count, 1).End(xlUp).Row
        If irow = 2 Then
            wb.Close False
        Else
            act = .Range("a3:d" & irow)
            For i = LBound(act, 1) To UBound(act, 1)
                act(i, 4) = Trim(act(i, 4))
                temp = Split(act(i, 4), " ")
                act(i, 4) = temp(UBound(temp))
                For j = LBound(temp) To UBound(temp) - 1
                    If j = 0 Then
                        s = temp(j)
                    Else
                        s = s & " " & temp(j)
                    End If
                Next
                act(i, 4) = "[" & act(i, 4) & "]" & " " & s
            Next
            
        End If
        .Range("a3").Resize(UBound(act, 1), UBound(act, 2)) = act
        wb.Close True
    End With
Next


End Sub

Sub CheckFilebyP6_Export()

'shname = "Activity List"
'For Each sh In ThisWorkbook.Sheets
'    If Left(sh.Name, 13) = shname Then
'        Debug.Print sh.Name
'        With Sheets(sh.Name)
'            irow = .Cells(Rows.Count, 2).End(xlUp).Row
'            temp = .Range("a6:x" & irow)
'            For i = LBound(temp, 1) To UBound(temp, 1)
'                cnt = cnt + 1
'                ReDim Preserve arr(1 To UBound(temp, 2), 1 To cnt)
'                For j = LBound(temp, 2) To UBound(temp, 2)
'                    arr(j, cnt) = temp(i, j)
'                Next
'            Next
'        End With
'    End If
'Next

'fpath = "C:\Users\Frail\Documents\Activity Code Add\"
fpath = "C:\Users\Frail\Documents\Activity Code Add\"
Set fso = CreateObject("scripting.filesystemobject")

Set fd = fso.GetFolder(fpath)

ReDim vdata(1 To 13, 1 To 1)

For Each fl In fd.Files
    Set wb = Workbooks.Open(fl.Path)
    With wb.ActiveSheet
        irow = .Cells(Rows.Count, 1).End(xlUp).Row
        If irow = 2 Then
            wb.Close False
        Else
            act = .Range("a3:m" & irow)
            '.Range("a3:d" & irow).Clear
            For i = LBound(act, 1) To UBound(act, 1)
                For j = LBound(act, 2) To UBound(act, 2)
                    cnt = cnt + 1
                    ReDim Preserve vdata(1 To 13, 1 To cnt)
                    vdata(j, cnt) = act(i, j)
                Next
            Next
            wb.Close False
        End If
    End With
    
Next


End Sub

