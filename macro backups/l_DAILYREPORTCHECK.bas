Attribute VB_Name = "l_DAILYREPORTCHECK"
Sub CheckWrittenData()
    Dim wsActivity As Worksheet, wsMP As Worksheet, wsVFACT As Worksheet, wsAdmin As Worksheet
    Dim actList As Variant, MPDB As Variant, VFACTDB As Variant
    Dim dAct As Object, dlog As Object
    Dim i As Long, j As Long, m As Long, irow As Long, icol As Long
    Dim tempArray As Variant, tempstr As String, brr As Variant
    
    Application.Calculation = xlCalculationManual
    Application.ScreenUpdating = False
    
    ' 设置工作表引用
    Set wsActivity = ThisWorkbook.Sheets("Activity List")
    Set wsMP = ThisWorkbook.Sheets("MP")
    Set wsVFACT = ThisWorkbook.Sheets("VFACT")
    Set wsAdmin = ThisWorkbook.Sheets("Admin")
    
    ' 错误处理
    On Error GoTo ErrorHandler
    
    ' 读取活动列表数据
    With wsActivity
        irow = .Cells(.Rows.Count, 3).End(xlUp).Row
        icol = .Cells(5, .Columns.Count).End(xlToLeft).Column
        actList = .Range(.Cells(6, 1), .Cells(irow, icol))
    End With
    
    ' 创建活动字典 (Key: 活动ID, Value: 活动数据数组)
    Set dAct = CreateObject("Scripting.Dictionary")
    ReDim temp(1 To UBound(actList, 1), 1 To icol)
    
    For i = 1 To UBound(actList, 1)
        If actList(i, 3) <> "" Then ' 检查活动名称是否存在
            tempstr = actList(i, 2) ' 活动ID
            
            ' 初始化或获取现有数据数组
            If Not dAct.Exists(tempstr) Then
                ReDim brr(1 To icol)
            Else
                brr = dAct(tempstr)
            End If
            
            ' 合并数据，使用@符号连接重复项
            For m = LBound(brr) To UBound(brr)
                If actList(i, m) <> "" Then
                    brr(m) = brr(m) & "@" & actList(i, m)
                Else
                    brr(m) = brr(m) & "@" & " "
                End If
            Next m
            
            dAct(tempstr) = brr
        End If
    Next i
    
    ' 创建差异日志字典
    Set dlog = CreateObject("Scripting.Dictionary")
    
    ' 处理MP工作表数据
    With wsMP
        MPDB = .ListObjects("MPDB").DataBodyRange.Value
        
        For i = LBound(MPDB, 1) To UBound(MPDB, 1)
            If dAct.Exists(MPDB(i, 2)) Then ' 如果活动ID存在于活动列表中
                tempArray = dAct(MPDB(i, 2))
                
                ' 检查项目名称是否匹配
                If MPDB(i, 3) <> ExtractValue(tempArray(14)) Then
                    If Not dlog.Exists(MPDB(i, 2)) Then
                        dlog.Add MPDB(i, 2), Array("MPDB", MPDB(i, 3))
                    End If
                End If
                
                ' 更新MPDB数据 (列7-17对应dAct的3-13)
                For j = 7 To 17
                    MPDB(i, j) = ExtractValue(tempArray(j - 4))
                Next j
            ElseIf MPDB(i, 2) <> "NULL" Then ' 活动ID不存在且不为NULL
                If Not dlog.Exists(MPDB(i, 2)) Then
                    dlog.Add MPDB(i, 2), Array("MPDB", MPDB(i, 3))
                End If
            End If
        Next i
        
        ' 更新MPDB表格数据
        .ListObjects("MPDB").DataBodyRange.Value = MPDB
    End With
    
    ' 处理VFACT工作表数据
    With wsVFACT
        VFACTDB = .ListObjects("VFACTDB").DataBodyRange.Value
        
        For i = LBound(VFACTDB, 1) To UBound(VFACTDB, 1)
            If dAct.Exists(VFACTDB(i, 2)) Then ' 如果活动ID存在于活动列表中
                tempArray = dAct(VFACTDB(i, 2))
                
                ' 检查项目名称是否匹配
                If VFACTDB(i, 3) <> ExtractValue(tempArray(14)) Then
                    If Not dlog.Exists(VFACTDB(i, 2)) Then
                        dlog.Add VFACTDB(i, 2), Array("VFACTDB", VFACTDB(i, 3))
                    End If
                End If
                    
                ' 更新VFACTDB数据 (列4-12对应dAct的3-11)
                For j = 4 To 12
                    VFACTDB(i, j) = ExtractValue(tempArray(j - 1))
                Next j
                
                ' 更新VFACTDB数据 (列14-15对应dAct的12-13)
                For j = 14 To 15
                    VFACTDB(i, j) = ExtractValue(tempArray(j - 2))
                Next j

            Else ' 活动ID不存在
                If Not dlog.Exists(VFACTDB(i, 2)) Then
                    dlog.Add VFACTDB(i, 2), Array("VFACTDB", VFACTDB(i, 3))
                End If
            End If
        Next i
        
        ' 更新VFACTDB表格数据
        .ListObjects("VFACTDB").DataBodyRange.Value = VFACTDB
    End With
    
    ' 记录差异日志到Admin工作表
    With wsAdmin
        ' 清除旧日志 (从第22行开始)
        irow = .Cells(.Rows.Count, 3).End(xlUp).Row + 1
        If irow > 26 Then
            .Range(.Cells(26, 3), .Cells(200, 5)).ClearContents
        End If
        
        ' 写入新日志
        irow = .Cells(.Rows.Count, 3).End(xlUp).Row + 1
        For Each k In dlog.Keys
            tempArray = dlog(k)
            .Cells(irow, 3) = k ' 活动ID
            .Cells(irow, 4) = tempArray(0) ' 来源表
            .Cells(irow, 5) = tempArray(1) ' 原始值
            irow = irow + 1
        Next k
    End With
    
    MsgBox "数据检查和更新完成!", vbInformation
    Exit Sub
    
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
ErrorHandler:
    MsgBox "发生错误: " & Err.Description, vbExclamation
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
End Sub

' 辅助函数：从@连接的字符串中提取值
Function ExtractValue(ByVal str As String) As String
    If str = "" Then
        ExtractValue = ""
    Else
        ExtractValue = Right(str, Len(str) - 1) ' 移除开头的@符号
    End If
End Function
