Attribute VB_Name = "m3_setoverallprogress"
Sub OptimizeDataTransfer()
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual
    Dim wb1 As Workbook, ws1 As Worksheet
    Dim wb2 As Workbook, ws2 As Worksheet
    Dim wb3 As Workbook, ws3 As Worksheet
    Dim wb4 As Workbook, ws4 As Worksheet
    Dim dictPlanR1 As Object, dictForecast As Object
    Set dictPlanR1 = CreateObject("Scripting.Dictionary")
    Set dictForecast = CreateObject("Scripting.Dictionary")
    Set dictPlanR0 = CreateObject("Scripting.Dictionary")
    
    ' 打开工作簿
    Set wb1 = ThisWorkbook
    Set ws1 = wb1.Worksheets("Overall WF Table")
    Set wb2 = Workbooks.Open("C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\Progress for BI_202411_AtCompletion.xlsx")
    Set ws2 = wb2.Worksheets("Sheet1")
    Set wb3 = Workbooks.Open("C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\Progress for BI_202411_Budget.xlsx")
    Set ws3 = wb3.Worksheets("Sheet1")
    Set wb4 = Workbooks.Open("C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\Progress for BI_202405_Budget.xlsx")
    Set ws4 = wb4.Worksheets("Sheet1")
    
    ' 一表到二表的列映射
    mappingResult = GenerateColumnMapping(ws1, ws2, 18, 29) ' R列和AC列起始
    colMapping1_2 = mappingResult(0)
    colMapping2_2 = mappingResult(1)

    ' 一表到三表的列映射
    mappingResult = GenerateColumnMapping(ws1, ws3, 18, 29) ' R列和AC列起始
    colMapping1_3 = mappingResult(0)
    colMapping2_3 = mappingResult(1)
    
    ' 一表到四表的列映射
    mappingResult = GenerateColumnMapping(ws1, ws4, 18, 29) ' R列和AC列起始
    colMapping1_4 = mappingResult(0)
    colMapping2_4 = mappingResult(1)
    
    
    
    
    ' 读取第一个表的数据并根据A列值分别存入字典
    Dim data1 As Variant
    data1 = ws1.Range("A1:R" & ws1.Cells(Rows.Count, 1).End(xlUp).Row).Value
    Dim i As Long
    For i = 2 To UBound(data1, 1)
        ' 假设B列是匹配的关键字，M列是要填充到第二表的Y列，N列填充到AA列
        If data1(i, 2) <> "" Then
            If data1(i, 1) = "Plan R1" Then
                If Not dictPlanR1.Exists(data1(i, 2)) Then
                    dictPlanR1.Add data1(i, 2), Array(data1(i, 13), data1(i, 14), i) ' 添加M、N、R列数据
                End If
            ElseIf data1(i, 1) = "Forecast" Then
                If Not dictForecast.Exists(data1(i, 2)) Then
                    dictForecast.Add data1(i, 2), Array(data1(i, 13), data1(i, 14), i) ' 添加M、N、R列数据
                End If
            ElseIf data1(i, 1) = "Plan R0" Then
                If Not dictPlanR0.Exists(data1(i, 2)) Then
                    dictPlanR0.Add data1(i, 2), Array(data1(i, 13), data1(i, 14), i)
                End If
            End If
        End If
    Next i

    ' 处理第二个表的数据（Forecast）
    Dim data2 As Variant
    data2 = ws2.Range("A2:AC" & ws2.Cells(Rows.Count, 1).End(xlUp).Row).Value
    For i = 1 To UBound(data2, 1)
        If dictForecast.Exists(data2(i, 1)) Then
            ' 获取匹配数据
            Dim matchedData As Variant
            matchedData = dictForecast(data2(i, 1))

            ' 填充数据
            ws2.Cells(i + 1, 25).Value = matchedData(0)  ' 填充M列到Y列
            ws2.Cells(i + 1, 26).Value = matchedData(0)
            ws2.Cells(i + 1, 27).Value = matchedData(1)  ' 填充N列到AA列
            icol = ws2.Cells(1, Columns.Count).End(xlToLeft).Column
            ReDim tempArray(1 To 1, 1 To 28)
            tempArray = ws2.Range("a" & i + 1 & ":  ab" & i + 1).Value2
            ReDim Preserve tempArray(1 To 1, 1 To icol)
            ' 使用列映射填充R列及以后的列
            Dim j As Long
            For j = LBound(colMapping1_2) To UBound(colMapping1_2)
                tempArray(1, colMapping2_2(j)) = matchedData(0) * ws1.Cells(matchedData(2), colMapping1_2(j)).Value
                'ws2.Cells(i + 1, colMapping2_2(j)).Value = matchedData(1) * ws1.Cells(matchedData(2), colMapping1_2(j)).Value
            Next j
            ws2.Cells(i + 1, 1).Resize(1, UBound(tempArray, 2)) = tempArray
        End If
    Next i

    ' 处理第三个表的数据（Plan R1）
    data2 = ws3.Range("A2:AC" & ws3.Cells(Rows.Count, 1).End(xlUp).Row).Value
    For i = 1 To UBound(data2, 1)
        If dictPlanR1.Exists(data2(i, 1)) Then
            ' 获取匹配数据
            matchedData = dictPlanR1(data2(i, 1))

            ' 填充数据
            ws3.Cells(i + 1, 25).Value = matchedData(0)  ' 填充M列到Y列
            ws3.Cells(i + 1, 26).Value = matchedData(0)
            ws3.Cells(i + 1, 27).Value = matchedData(1)  ' 填充N列到AA列
            icol = ws3.Cells(1, Columns.Count).End(xlToLeft).Column
            ReDim tempArray(1 To 1, 1 To 28)
            tempArray = ws3.Range("a" & i + 1 & ":  ab" & i + 1).Value2
            ReDim Preserve tempArray(1 To 1, 1 To icol)
            For j = LBound(colMapping1_3) To UBound(colMapping1_3)
'                Debug.Print "第一个表列号: " & colMapping1_3(j) & ", 第二个表列号: " & colMapping2_3(j)
                tempArray(1, colMapping2_3(j)) = matchedData(0) * ws1.Cells(matchedData(2), colMapping1_3(j)).Value
                'ws3.Cells(i + 1, colMapping2_3(j)).Value = matchedData(1) * ws1.Cells(matchedData(2), colMapping1_3(j)).Value
'                Debug.Print ws1.Cells(matchedData(2), colMapping1_3(j)).Value & i + 1 & matchedData(1)
            Next j
            ws3.Cells(i + 1, 1).Resize(1, UBound(tempArray, 2)) = tempArray
        End If
    Next i
    
    ' 处理第四个表的数据（Plan R0）
    data2 = ws4.Range("A2:AC" & ws4.Cells(Rows.Count, 1).End(xlUp).Row).Value
    For i = 1 To UBound(data2, 1)
        If dictPlanR0.Exists(data2(i, 1)) Then
            ' 获取匹配数据
            matchedData = dictPlanR0(data2(i, 1))

            ' 填充数据
            ws4.Cells(i + 1, 25).Value = matchedData(0)  ' 填充M列到Y列
            ws4.Cells(i + 1, 26).Value = matchedData(0)
            ws4.Cells(i + 1, 27).Value = matchedData(1)  ' 填充N列到AA列
            icol = ws4.Cells(1, Columns.Count).End(xlToLeft).Column
            ReDim tempArray(1 To 1, 1 To 28)
            tempArray = ws4.Range("a" & i + 1 & ":  ab" & i + 1).Value2
            ReDim Preserve tempArray(1 To 1, 1 To icol)
            For j = LBound(colMapping1_4) To UBound(colMapping1_4)
'                Debug.Print "第一个表列号: " & colMapping1_3(j) & ", 第二个表列号: " & colMapping2_3(j)
                tempArray(1, colMapping2_4(j)) = matchedData(0) * ws1.Cells(matchedData(2), colMapping1_4(j)).Value
                'ws3.Cells(i + 1, colMapping2_3(j)).Value = matchedData(1) * ws1.Cells(matchedData(2), colMapping1_3(j)).Value
'                Debug.Print ws1.Cells(matchedData(2), colMapping1_3(j)).Value & i + 1 & matchedData(1)
            Next j
            ws4.Cells(i + 1, 1).Resize(1, UBound(tempArray, 2)) = tempArray
        End If
    Next i
    
    ' 清理对象
    Set dictPlanR0 = Nothing
    Set dictPlanR1 = Nothing
    Set dictForecast = Nothing
    wb2.Close True
    wb3.Close True
    wb4.Close True
    Set wb1 = Nothing
    Set wb2 = Nothing
    Set wb3 = Nothing
    Set wb4 = Nothing
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    Application.Calculation = xlCalculationAutomatic
    
End Sub
Function GenerateColumnMapping(ws1 As Worksheet, wsTarget As Worksheet, startCol1 As Long, startCol2 As Long) As Variant
    Dim colMapping1() As Long, colMapping2() As Long
    Dim i As Long, j As Long
    Dim lastCol1 As Long, lastCol2 As Long
    Dim mappingIndex As Long
    Dim firstTableHeaders As Variant, targetTableHeaders As Variant

    ' 获取第一个工作表从 startCol1 开始的列数
    lastCol1 = ws1.Cells(1, Columns.Count).End(xlToLeft).Column
    ' 获取目标工作表从 startCol2 开始的列数
    lastCol2 = wsTarget.Cells(1, Columns.Count).End(xlToLeft).Column

    ' 获取第一个表从 startCol1 开始的列标题
    firstTableHeaders = ws1.Range(ws1.Cells(1, startCol1), ws1.Cells(1, lastCol1)).Value
    ' 获取目标表从 startCol2 开始的列标题
    targetTableHeaders = wsTarget.Range(wsTarget.Cells(1, startCol2), wsTarget.Cells(1, lastCol2)).Value

    ' 初始化匹配数组
    ReDim colMapping1(1 To 1)
    ReDim colMapping2(1 To 1)
    mappingIndex = 0

    ' 遍历目标表的列标题，检查是否与第一个表的列标题匹配
    For i = 1 To UBound(targetTableHeaders, 2)
        For j = 1 To UBound(firstTableHeaders, 2)
            If targetTableHeaders(1, i) = firstTableHeaders(1, j) Then
                ' 如果标题匹配，记录对应的列号
                mappingIndex = mappingIndex + 1
                ReDim Preserve colMapping1(1 To mappingIndex)
                ReDim Preserve colMapping2(1 To mappingIndex)
                colMapping1(mappingIndex) = j + startCol1 - 1 ' 第一个表列号调整为实际列
                colMapping2(mappingIndex) = i + startCol2 - 1 ' 目标表列号调整为实际列
                Exit For
            End If
        Next j
    Next i

    ' 返回两个匹配列号数组
    GenerateColumnMapping = Array(colMapping1, colMapping2)
End Function


