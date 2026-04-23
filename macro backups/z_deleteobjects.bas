Attribute VB_Name = "z_deleteobjects"
Sub del_objects()
    Dim obj As Object
    Application.Calculation = xlCalculationManual
    Application.ScreenUpdating = False
    ' 循环遍历所有对象并删除它们
    For Each obj In ActiveSheet.Shapes
        obj.Delete
    Next obj
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    
End Sub


Sub addrows()
    Dim ws As Worksheet
    Dim irow As Long
    Dim i As Long

    Set ws = Sheets("Overall WF")

    With ws
        irow = .Cells(.Rows.Count, 2).End(xlUp).Row
        For i = irow To 10 Step -3
            .Rows(i - 2).Copy
            .Rows(i - 2).Insert Shift:=xlDown
            .Cells(i - 2, 13).Value = "Plan R0"
            .Cells(i - 1, 13).Value = "Plan R1"
            '.Rows(i - 1).PasteSpecial Paste:=xlPasteFormats
            '.Rows(i - 1).PasteSpecial Paste:=xlPasteValues
            Application.CutCopyMode = False
        Next i
    End With
End Sub

