Attribute VB_Name = "m_savetoDBII"
Sub saveMPto_DBII()

Dim arr As Variant, brr As Variant
Dim fso As New Scripting.FileSystemObject, fl, fd, fd1
Dim fpath As String
Dim wb, sh
Dim oPV As ProtectedViewWindow
Dim i, j, s
Dim pt As PivotTable, pf As PivotField, pi As PivotItem
Dim TargetDate
'Application.Calculation = xlCalculationManual
Application.ScreenUpdating = False



TargetDate = Date
'OVRID, actID, PhysicalVolumeCompleted.

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\RECEIVE\MP\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\RECEIVE\MP\"
ReDim brr(1 To 18, 1 To 1) 'date, id, team, type, nums_mp, nums_op, project, subproject, phase, train, unit, block, title, discipline, wkp, remarks

Set fso = New Scripting.FileSystemObject
Set fd = fso.GetFolder(fpath)
For Each fd1 In fd.SubFolders
    If fd1.Name = Format(TargetDate, "YYYYMMDD") Then
        For Each fl In fd1.Files
            Workbooks.Open fl.Path, False
            Set wb = Workbooks(fl.Name)
            wb.Activate
            Set oPV = Excel.Application.ActiveProtectedViewWindow
            If oPV Is Nothing Then
            
            Else
                With oPV
                    Set wb = .Edit
                End With
            End If
            Set oPV = Nothing
            
            Set sh = wb.Worksheets("MP-" & Format(TargetDate, "YYYYMMDD"))
            With sh
                .Unprotect "cc7"
                .Outline.ShowLevels RowLevels:=8
                If .FilterMode = True And .AutoFilterMode = True Then
                    .ShowAllData
                End If
                
                irow = .Cells(Rows.Count, 1).End(xlUp).Row
                icol = .Cells(12, Columns.Count).End(xlToLeft).Columns
                arr = .Range(.Cells(13, 1), .Cells(irow, icol)).Value
                If IsEmpty(arr) Then
                    wb.Close False
                     GoTo nextfor
                End If
                'save indirect manpower and day-off
                For i = 2 To 7
                    If .Range("q" & i).Value > 0 Then
                        s = s + 1
                        ReDim Preserve brr(1 To 18, 1 To s) 'date, id, team, type, nums_mp, nums_op, project, subproject, phase, train, unit, block, title, discipline, wkp,remarks
                        If i <> 7 Then
                            brr(1, s) = TargetDate
                            brr(2, s) = "NULL"
                            brr(3, s) = .Range("b7").Value
                            brr(4, s) = "Indirect"
                            brr(5, s) = .Range("q" & i).Value
                            brr(6, s) = 0
                            brr(16, s) = .Range("o" & i).Value
                        Else
                            brr(1, s) = TargetDate
                            brr(2, s) = "NULL"
                            brr(3, s) = .Range("b7").Value
                            brr(4, s) = "Direct"
                            brr(5, s) = .Range("q" & i).Value
                            brr(6, s) = 0
                            brr(16, s) = .Range("o" & i).Value
                        End If
                    End If
                Next
                
                'direct
                'date, id, team, type, nums_mp, nums_op, project, subproject, phase, train, unit, block, title, discipline, wkp,remarks
                If UBound(arr, 1) = 2 Then
                
                Else
                     For i = LBound(arr, 1) To UBound(arr, 1)
                        If IsNumeric(arr(i, 17)) Then
                            If arr(i, 17) <> "" And arr(i, 17) <> 0 And arr(i, 12) = 8 Then
                                s = s + 1
                                ReDim Preserve brr(1 To 18, 1 To s)
                                brr(1, s) = TargetDate
                                brr(2, s) = arr(i, 2)
                                brr(3, s) = .Range("b7").Value
                                brr(4, s) = "Direct"
                                brr(5, s) = arr(i, 17)
                                brr(6, s) = arr(i, 18)
                                For j = 3 To 8
                                    brr(j + 4, s) = arr(i, j)
                                Next
                                If Left(brr(2, s), 2) = "EX" Then
                                    brr(13, s) = "EXT"
                                Else
                                    brr(13, s) = "Q" & Left(arr(i, 8), 2)
                                End If
                                brr(14, s) = Mid(arr(i, 8), 6, 5)
                                brr(15, s) = arr(i, 9)
                                brr(16, s) = arr(i, 10)
                                brr(17, s) = arr(i, 11)
                                brr(18, s) = arr(i, 19)
                            End If
                        End If
                    Next i
                End If
            End With
        wb.Close False
nextfor:
        Next
    End If
Next

Set fso = Nothing
Set fd = Nothing
Set fd1 = Nothing
ReDim temp(1 To UBound(brr, 2), 1 To UBound(brr, 1))

For i = LBound(brr, 2) To UBound(brr, 2)
    For j = LBound(brr, 1) To UBound(brr, 1)
        temp(i, j) = brr(j, i)
    Next
Next
result = temp


'wbPath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\GCC-OPG-PLAN-REPORT-MP.xlsm"
wbPath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\GCC-OPG-PLAN-REPORT-MP.xlsm"
Set wb = Workbooks.Open(wbPath, False)
With ActiveWorkbook.Sheets("DB")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row + 1
    .Range("a" & irow).Resize(UBound(result, 1), UBound(result, 2)) = result
    
End With
'With wb.Sheets("Info_(today)")
'    .Activate
'    selectDate = Date
'    Set pt = .PivotTables("Info_Today")
'    Application.EnableEvents = False
'    pt.PivotCache.Refresh
'
'    Set sc = wb.SlicerCaches("Slicer_Date")
'    sc.ClearAllFilters
'    Application.EnableEvents = False
'    If Not sc Is Nothing Then
'        For Each si In sc.SlicerItems
'            If CDate(si.Value) = selectDate Then
'
'                si.Selected = True
'                Exit For
'            Else
'                si.Selected = False
'            End If
'        Next
'    End If
'    Application.EnableEvents = True
'
'End With
wb.Close True
With ThisWorkbook.Sheets("MP")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row + 1
    .Range("a" & irow).Resize(UBound(result, 1), UBound(result, 2)) = result
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    Set tbl = .ListObjects("MPDB")
    Set arr = .Range("a1").CurrentRegion
    tbl.Resize arr
End With
'Application.Calculation = True
Application.ScreenUpdating = True
saveVFACTto_DBII
CheckWrittenData
End Sub


Sub saveVFACTto_DBII()
    Dim arr As Variant, brr As Variant, ovrList As Variant, result As Variant
    Dim fso As New Scripting.FileSystemObject, fl, fd, fd1
    Dim fpath As String, wbPath As String
    Dim wb As Workbook, sh As Worksheet, tbl As ListObject
    Dim oPV As ProtectedViewWindow, pt As PivotTable, sc As SlicerCache
    Dim i As Long, j As Long, s As Long, irow As Long, icol As Long
    Dim TargetDate
    Dim selectDate As Date, dict As Object
    
    TargetDate = Date - 1
    
    '================== 初始化设置 ==================
    Application.ScreenUpdating = False
    'Application.Calculation = xlCalculationManual
    Application.EnableEvents = False
    Application.DisplayAlerts = False
    Set dict = CreateObject("Scripting.Dictionary")
    
    '================== 数据准备 ==================
    fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\RECEIVE\VFACT\"
    ReDim brr(1 To 18, 1 To 10000)
    
    '优化Activity List加载为字典
    With Sheets("Activity List")
        irow = .Cells(Rows.Count, 1).End(xlUp).Row
        ovrList = .Range(.Cells(6, 1), .Cells(irow, 35)).Value
        For j = 1 To UBound(ovrList, 1)
            If Not IsEmpty(ovrList(j, 2)) Then
                dict(ovrList(j, 2)) = Array(ovrList(j, 11), ovrList(j, 12), ovrList(j, 13))
            End If
        Next j
    End With

    '================== 文件处理 ==================
    Set fd = fso.GetFolder(fpath)
    For Each fd1 In fd.SubFolders
        If fd1.Name = Format(TargetDate, "YYYYMMDD") Then
            For Each fl In fd1.Files
                '? 优化文件打开方式
                Set wb = Workbooks.Open(fl.Path, ReadOnly:=True, UpdateLinks:=0)
                
                '? 简化受保护视图处理
                If wb.IsInplace Then
                    wb.Activate
                    Set oPV = Application.ActiveProtectedViewWindow
                    If Not oPV Is Nothing Then Set wb = oPV.Edit
                End If
                
                Set sh = wb.Worksheets("VFACT-" & Format(TargetDate, "YYYYMMDD"))
                With sh
                    .Unprotect "cc7"
                    .Outline.ShowLevels RowLevels:=8
                    If .FilterMode Then .ShowAllData
                    
                    irow = .Cells(Rows.Count, 1).End(xlUp).Row
                    icol = .Cells(12, .Columns.Count).End(xlToLeft).Column
                    If irow < 13 Then GoTo CloseWorkbook
                    
                    arr = .Range(.Cells(13, 1), .Cells(irow, icol)).Value
                    If IsEmpty(arr) Then GoTo CloseWorkbook

                    '? 优化数据填充逻辑
                    For i = 1 To UBound(arr, 1)
                        If arr(i, 23) > 0 And arr(i, 12) = 9 Then
                            If dict.Exists(arr(i, 2)) Then
                                If dict(arr(i, 2))(2) <> "PI04" And dict(arr(i, 2))(2) <> "PI05" Then
                                    s = s + 1
                                    If s > UBound(brr, 2) Then ReDim Preserve brr(1 To 18, 1 To s + 1000)
                                    
                                    '? 使用字典加速查找
                                    brr(1, s) = TargetDate
                                    brr(2, s) = arr(i, 2)
                                    brr(3, s) = .Range("B7").Value
                                    For j = 3 To 8: brr(j + 1, s) = arr(i, j): Next
                                    brr(10, s) = IIf(Left(brr(2, s), 2) = "EX", "EXT", "Q" & Left(arr(i, 8), 2))
                                    brr(11, s) = Mid(arr(i, 8), 6, 5)
                                    brr(13, s) = arr(i, 9)
                                    brr(14, s) = CStr(arr(i, 10))
                                    
                                    If dict.Exists(arr(i, 2)) Then
                                        brr(12, s) = dict(arr(i, 2))(0)
                                        brr(14, s) = dict(arr(i, 2))(1)
                                        brr(15, s) = dict(arr(i, 2))(2)
                                    End If
                                    
                                    brr(16, s) = arr(i, 23)
                                End If
                            End If
                        End If
                    Next i
                End With

CloseWorkbook:
                wb.Close False
                Set wb = Nothing
            Next fl
        End If
    Next fd1

    '================== 数据保存 ==================
    '? 优化数组转置
    ReDim result(1 To s, 1 To 18)
    For i = 1 To s
        For j = 1 To 18
            result(i, j) = brr(j, i)
        Next
    Next
    WeldDB = ThisWorkbook.Sheets("VFACT(Welding DB)").ListObjects("WeldDB").DataBodyRange

    '================== 本地保存 ==================
    With ThisWorkbook.Sheets("VFACT")
        irow = .Cells(.Rows.Count, 1).End(xlUp).Row
        For i = 2 To irow
            If .Cells(i, 15) = "PI04" Or .Cells(i, 15) = "PI05" Then
                toDeleteFrom = i
                Exit For
            End If
        Next
        If toDeleteFrom > 0 Then
            .Range("a" & toDeleteFrom & ": a" & irow).EntireRow.Delete
        End If
        irow = .Cells(.Rows.Count, 1).End(xlUp).Row + 1
        ApplyFormattingVFACT ThisWorkbook.Sheets("VFACT"), irow + s + UBound(WeldDB, 1)
        .Range("A" & irow).Resize(s, 18) = result
        irow = .Cells(.Rows.Count, 1).End(xlUp).Row + 1
        .Range("A" & irow).Resize(UBound(WeldDB, 1), 16) = WeldDB
        .ListObjects("VFACTDB").Resize .Range("A1").CurrentRegion
        FinalVFACTDB = .ListObjects("VFACTDB").DataBodyRange
    End With
    
    '? 优化数据库更新
    wbPath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\GCC-OPG-PLAN-REPORT-VFACT.xlsm"
    Set wb = Workbooks.Open(wbPath, ReadOnly:=False, UpdateLinks:=0)
    With wb.Sheets("DB")
        .Range("a2").Resize(UBound(FinalVFACTDB, 1), 16) = FinalVFACTDB
        .ListObjects("VFACTDB").Resize .Range("A1").CurrentRegion
        
    End With
    
    '? 优化切片器操作（核心修改）
    With wb.Sheets("Info_(today)")
        selectDate = TargetDate
        .PivotTables("Info_Today").PivotCache.Refresh
'        Set sc = wb.SlicerCaches("Slicer_Date")
'        If Not sc Is Nothing Then
'            sc.ClearManualFilter
'            For Each si In sc.SlicerItems
'                If si.Value = selectDate Then
'                    si.Selected = True
'                    Exit For
'                Else
'                    si.Selected = False
'                End If
'            Next
'        End If
    End With
    
    wb.Close True
    Set wb = Nothing

    '================== 清理资源 ==================
    Set dict = Nothing
    Set fso = Nothing
    'Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    Application.DisplayAlerts = True
End Sub

Sub ApplyFormattingVFACT(sh As Worksheet, lastRow As Long)
    If lastRow < 2 Then Exit Sub ' 无数据时退出
    With sh
        ' 日期列 (A列)
        .Range("A2:A" & lastRow).NumberFormat = "yyyy/m/d"
        ' 文本列 (B到O列)
        .Range("B2:O" & lastRow).NumberFormat = "@"
        ' 数值列 (P列)
        .Range("P2:P" & lastRow).NumberFormat = "0.00"
    End With
End Sub


