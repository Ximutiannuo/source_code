Attribute VB_Name = "a_genActivityList_c"
Sub RefreshActivityCfromP6()
Dim p6act, updqty, wkPKG, vFact
Dim fpath As String
Dim budgetedWB As Workbook, forecastWB As Workbook
Dim dbudgeted As Object, dforecast As Object
Dim result2() As Double, chunkSize As Long
Dim i As Long, j As Long, colChunk As Long, chunkStart As Long, chunkEnd As Long
Dim budgetedrownum_vol As Long, budgetedrownum_wf As Long, budgetedrownum_mh As Long
Dim forecastrownum_vol As Long, forecastrownum_wf As Long, forecastrownum_mh As Long
Dim validCols As Collection, colDate As Date
startTime = Timer

Application.Calculation = xlCalculationManual
Application.ScreenUpdating = False


With Sheets("Activity(C_P6)")
    p6act = .ListObjects("CON").DataBodyRange
End With

With Sheets("UpdateQuantity")
    updqty = .ListObjects("RSC_Define").DataBodyRange
End With

With Sheets("WorkSteps_C")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(3, Columns.Count).End(xlToLeft).Column
    wkPKG = .Range(.Cells(4, 1), .Cells(irow, icol)).Value
End With

With Sheets("RSC")
    irow = .Cells(Rows.Count, 5).End(xlUp).Row
    rsc = .Range(.Cells(1, 5), .Cells(irow, 9)).Value
End With

With Sheets("VFACT")
    vFact = .ListObjects("VFACTDB").DataBodyRange
End With

With Sheets("MP")
    mp = .ListObjects("MPDB").DataBodyRange
End With


With Sheets("Activity List( from TEAMs)")
    changeActStatus = .ListObjects("Construction_Teams").DataBodyRange
End With


Set d = CreateObject("scripting.dictionary")

For i = LBound(vFact, 1) To UBound(vFact, 1)
    If Not d.Exists(vFact(i, 2)) Then
        ReDim brr(1 To 3)
    Else
        brr = d(vFact(i, 2))
    End If
    brr(1) = brr(1) + vFact(i, 16)
    If brr(2) = 0 Then
        brr(2) = vFact(i, 1)
    Else
        If vFact(i, 1) < brr(2) Then
            brr(2) = vFact(i, 1)
        End If
    End If
    If vFact(i, 1) > brr(3) Then
        brr(3) = vFact(i, 1)
    End If
    d(vFact(i, 2)) = brr
Next

k = d.Keys
t = d.Items

Set d1 = CreateObject("scripting.dictionary")
For i = LBound(mp, 1) To UBound(mp, 1)
    If Not d1.Exists(mp(i, 2)) Then
        ReDim brr(1 To 3)
    Else
        brr = d1(mp(i, 2))
    End If
    brr(1) = brr(1) + mp(i, 5)
    If brr(2) = 0 Then
        brr(2) = mp(i, 1)
    Else
        If mp(i, 1) < brr(2) Then
            brr(2) = mp(i, 1)
        End If
    End If
    If mp(i, 1) > brr(3) Then
        brr(3) = mp(i, 1)
    End If
    d1(mp(i, 2)) = brr
Next

k1 = d1.Keys
t1 = d1.Items


ReDim result(1 To UBound(p6act, 1), 1 To 38)

For i = LBound(result, 1) To UBound(result, 1)
    result(i, 1) = p6act(i, 5) 'wbs
    result(i, 2) = p6act(i, 3) 'id
    result(i, 3) = p6act(i, 7) 'project
    result(i, 4) = p6act(i, 8) 'subproject
    result(i, 5) = p6act(i, 9) 'phase
    result(i, 6) = p6act(i, 10) 'train
    result(i, 7) = p6act(i, 11) 'unit
    result(i, 8) = p6act(i, 12) 'block
    result(i, 9) = p6act(i, 16) 'quarter
    result(i, 10) = Mid(result(i, 8), 6, 5) 'mainblock
    result(i, 11) = p6act(i, 6) 'description
    result(i, 12) = p6act(i, 13) 'discipline
    result(i, 13) = p6act(i, 14) 'workpackage
    result(i, 14) = p6act(i, 15) 'scope
    result(i, 15) = p6act(i, 17) 'simpblk
    result(i, 16) = p6act(i, 18) 'startupseq

    result(i, 18) = p6act(i, 19) 'bccdiscipline
    result(i, 19) = p6act(i, 20) 'bccworkpackage
    
    result(i, 26) = p6act(i, 21) 'bl start
    result(i, 27) = p6act(i, 22) 'bl finish
    result(i, 28) = p6act(i, 22) - p6act(i, 21) + 1 'bl duration
    result(i, 29) = p6act(i, 23) 'start
    result(i, 30) = p6act(i, 24) 'finish
    result(i, 31) = p6act(i, 27) 'atcompletionduration

    'result(i, 38) = "Y"
    
    For j = LBound(updqty, 1) To UBound(updqty, 1)
        If result(i, 2) = updqty(j, 1) Then
            result(i, 20) = updqty(j, 2) 'keyqty
            Exit For
        End If
    Next

    For j = LBound(rsc, 1) To UBound(rsc, 1)
        If result(i, 13) = rsc(j, 1) Then
            result(i, 22) = rsc(j, 3) 'rsc id
            Exit For
        End If
    Next
    For j = LBound(k) To UBound(k) 'manpower
        If result(i, 2) = k(j) Then
            result(i, 32) = t(j)(2) 'start
            result(i, 33) = t(j)(3) 'finish
            result(i, 35) = t(j)(1) 'completed
            Exit For
        End If
    Next
    For j = LBound(k1) To UBound(k1) 'vfact
        If result(i, 2) = k1(j) Then
            result(i, 36) = t1(j)(1) * 10 'actual manhour
            If t1(j)(2) <> 0 Then
                If t1(j)(2) < result(i, 32) Or result(i, 32) = Empty Then
                    result(i, 32) = t1(j)(2) 'actual start
                End If
            End If
            If t1(j)(3) > 0 Then
                If t1(j)(3) > result(i, 33) Then
                    result(i, 33) = t1(j)(3) 'actal finish
                End If
            End If
            result(i, 34) = result(i, 33) - result(i, 32) + 1
        End If
    Next
    For j = LBound(wkPKG, 1) To UBound(wkPKG, 1)
        If result(i, 13) = wkPKG(j, 3) Then
            result(i, 17) = wkPKG(j, 5) 'uom
            result(i, 21) = wkPKG(j, 8) * result(i, 20) 'unit-manhour * total qty
            result(i, 37) = wkPKG(j, 8) * result(i, 35)  'unit-manhour * completed qty
            Exit For
        End If
    Next
Next

Set d = Nothing
Set d1 = Nothing
Set d = CreateObject("scripting.dictionary")

For i = LBound(result, 1) To UBound(result, 1)
    tempstr = result(i, 15) & "@" & result(i, 13)
    d(tempstr) = d(tempstr) + result(i, 21) 'manhours
Next

k = d.Keys
t = d.Items



For i = LBound(result, 1) To UBound(result, 1)
    If result(i, 13) = "PI08" Then
        For j = LBound(k) To UBound(k)
            If result(i, 15) = Left(k(j), 7) And Right(k(j), 4) = "PI05" Then
                PI08MH = PI08MH + t(j)
                Exit For
            End If
        Next
        result(i, 21) = PI08MH * 0.3
    End If
    PI08MH = 0
Next

Set d = Nothing
Set d = CreateObject("scripting.dictionary")

For i = LBound(result, 1) To UBound(result, 1)
    d(result(i, 3)) = d(result(i, 3)) + result(i, 21)
Next
k = d.Keys
t = d.Items

For i = LBound(result, 1) To UBound(result, 1)
    result(i, 24) = result(i, 21) / t(0) '% wf
    result(i, 25) = result(i, 24) * 254137500 ' wf.
    result(i, 37) = result(i, 37) / t(0) * 254137500
Next

With Sheets("Activity List")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    If irow >= 6 Then
        .Range("a6:ar" & irow).Clear
    End If
    .Range("j6:j" & UBound(result, 1) + 5).NumberFormat = "@"
    .Range("x6:x" & UBound(result, 1) + 5).NumberFormat = "0.00%"
    .Range("a6").Resize(UBound(result, 1), UBound(result, 2)) = result
End With



fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\BI\"

Set dbudgeted = CreateObject("Scripting.Dictionary")
Set dforecast = CreateObject("Scripting.Dictionary")
chunkSize = 50  ' 每次处理50列

' ===== 1. 加载核心数据 =====
' 只加载必要的主键列（A-Q列）
Set budgetedWB = Workbooks.Open(fpath & "Progress for BI_202411_Budget.xlsx", ReadOnly:=True)
With budgetedWB.Sheets("Sheet1")
    budgetedrng = .Range("A1:Q" & .Cells(.Rows.Count, 1).End(xlUp).Row).Value2
End With
Set forecastWB = Workbooks.Open(fpath & "Progress for BI_202411_AtCompletion.xlsx", ReadOnly:=True)
With forecastWB.Sheets("Sheet1")
    forecastrng = .Range("A1:Q" & .Cells(.Rows.Count, 1).End(xlUp).Row).Value2
End With

' ===== 2. 构建字典 =====
For i = 2 To UBound(budgetedrng, 1)
    dbudgeted(budgetedrng(i, 1) & "@" & budgetedrng(i, 17)) = i
Next
For i = 2 To UBound(forecastrng, 1)
    dforecast(forecastrng(i, 1) & "@" & forecastrng(i, 17)) = i
Next

' ===== 3. 初始化结果数组 =====
ReDim result2(1 To UBound(result, 1), 1 To 6)

' ===== 4. 分块处理日期列 =====
' 步骤4.1: 预计算所有有效列
Set validCols = New Collection
With budgetedWB.Sheets("Sheet1")
    For j = 29 To .Cells(1, .Columns.Count).End(xlToLeft).Column
        colDate = .Cells(1, j).Value
        If colDate < Date Then validCols.Add j
    Next
End With

' 步骤4.2: 按分块处理列
For colChunk = 1 To validCols.Count Step chunkSize
    chunkStart = colChunk
    chunkEnd = Application.Min(colChunk + chunkSize - 1, validCols.Count)
    
    ' 步骤4.3: 加载当前分块列数据
    Dim budgetedChunk As Variant, forecastChunk As Variant
    With budgetedWB.Sheets("Sheet1")
        budgetedChunk = .Range(.Cells(2, validCols(chunkStart)), _
                              .Cells(UBound(budgetedrng, 1), validCols(chunkEnd))).Value2
    End With
    With forecastWB.Sheets("Sheet1")
        forecastChunk = .Range(.Cells(2, validCols(chunkStart)), _
                              .Cells(UBound(forecastrng, 1), validCols(chunkEnd))).Value2
    End With

    ' 步骤4.4: 处理当前分块
    For i = LBound(result, 1) To UBound(result, 1)
        ' 获取行号
        budgetedrownum_vol = SafeGet(dbudgeted, result(i, 2) & "@" & result(i, 22), -1)
        budgetedrownum_wf = SafeGet(dbudgeted, result(i, 2) & "@GCC_WF", -1)
        budgetedrownum_mh = SafeGet(dbudgeted, result(i, 2) & "@GCC_MP", -1)
        forecastrownum_vol = SafeGet(dforecast, result(i, 2) & "@" & result(i, 22), -1)
        forecastrownum_wf = SafeGet(dforecast, result(i, 2) & "@GCC_WF", -1)
        forecastrownum_mh = SafeGet(dforecast, result(i, 2) & "@GCC_MP", -1)

        ' 处理当前分块中的每一列
        For j = chunkStart To chunkEnd
            Dim colIndex As Long
            colIndex = j - chunkStart + 1  ' 当前分块内的列索引

            ' Budget累加
            If budgetedrownum_wf > 0 Then
                result2(i, 1) = result2(i, 1) + budgetedChunk(budgetedrownum_wf - 1, colIndex)
            End If
            If budgetedrownum_mh > 0 Then
                result2(i, 2) = result2(i, 2) + budgetedChunk(budgetedrownum_mh - 1, colIndex)
            End If
            If budgetedrownum_vol > 0 Then
                result2(i, 3) = result2(i, 3) + budgetedChunk(budgetedrownum_vol - 1, colIndex)
            End If

            ' Forecast累加
            If forecastrownum_wf > 0 Then
                result2(i, 4) = result2(i, 4) + forecastChunk(forecastrownum_wf - 1, colIndex)
            End If
            If forecastrownum_mh > 0 Then
                result2(i, 5) = result2(i, 5) + forecastChunk(forecastrownum_mh - 1, colIndex)
            End If
            If forecastrownum_vol > 0 Then
                result2(i, 6) = result2(i, 6) + forecastChunk(forecastrownum_vol - 1, colIndex)
            End If
        Next j
    Next i

    ' 步骤4.5: 释放当前分块内存
    Erase budgetedChunk
    Erase forecastChunk
Next colChunk

' ===== 5. 清理资源 =====
budgetedWB.Close False
forecastWB.Close False
Set budgetedWB = Nothing
Set forecastWB = Nothing
Application.Calculation = xlCalculationAutomatic
Application.ScreenUpdating = True

With Sheets("Activity List")
    .Range("am6").Resize(UBound(result2, 1), UBound(result2, 2)) = result2
End With


Set dChangeActStatus = CreateObject("scripting.dictionary")
For i = LBound(changeActStatus, 1) To UBound(changeActStatus, 1)
    dChangeActStatus(changeActStatus(i, 2)) = changeActStatus(i, 3)
Next

ReDim result3(1 To UBound(result, 1), 1 To 1)

For i = LBound(result3, 1) To UBound(result3, 1)
    If dChangeActStatus.Exists(result(i, 2)) Then
        result3(i, 1) = dChangeActStatus(result(i, 2))
    End If
Next

With Sheets("Activity List")
    .Range("al6").Resize(UBound(result3, 1), 1) = result3
End With

FinishTime = Timer
ElapsedTime = FinishTime - startTime
MsgBox "Activity List Refreshed, Elapsed Time: " & Format(ElapsedTime \ 60, "00") & ":" & Format(ElapsedTime Mod 60, "00") & "."

End Sub

Function SafeGet(dict As Object, key As String, Optional default As Long = -1) As Long
    SafeGet = IIf(dict.Exists(key), dict(key), default)
End Function

Sub geneBlockList()

Dim vdata, blockList, wkPKG, actList
With Sheets("Facility List")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row - 12
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(3, 1), .Cells(irow, icol)).Value
    ReDim blockList(1 To UBound(vdata, 2), 1 To 1)
    For i = LBound(vdata, 1) To UBound(vdata, 1)
        If vdata(i, 11) = "" Then
        Else
            cnt = cnt + 1
            ReDim Preserve blockList(1 To UBound(vdata, 2), 1 To cnt)
            For j = LBound(vdata, 2) To UBound(vdata, 2)
                blockList(j, cnt) = CStr(vdata(i, j))
            Next
        End If
    Next
    ReDim temp(1 To UBound(blockList, 2), 1 To UBound(blockList, 1))
    For i = LBound(blockList, 2) To UBound(blockList, 2)
        For j = LBound(blockList, 1) To UBound(blockList, 1)
            temp(i, j) = blockList(j, i)
        Next
    Next
    blockList = temp
End With


With Sheets("WorkSteps_C")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(3, Columns.Count).End(xlToLeft).Column
    wkPKG = .Range(.Cells(4, 1), .Cells(irow, icol)).Value
End With
cnt = 0
With Sheets("Activity List")
    ReDim actList(1 To 28, 1 To 1)
    For i = LBound(blockList, 1) To UBound(blockList, 1)
        For j = LBound(wkPKG, 1) To UBound(wkPKG, 1)
            If wkPKG(j, 1) <> "" Then
                cnt = cnt + 1
                ReDim Preserve actList(1 To 28, 1 To cnt)
                actList(3, cnt) = blockList(i, 11)
                actList(4, cnt) = blockList(i, 12)
                If wkPKG(j, 1) <> "MM" Then
                    actList(5, cnt) = "CT"
                Else
                    actList(5, cnt) = "CM"
                End If
                actList(6, cnt) = blockList(i, 13)
                actList(7, cnt) = blockList(i, 14)
                actList(8, cnt) = blockList(i, 10)
                actList(9, cnt) = blockList(i, 16) & ": " & wkPKG(j, 4)
                actList(10, cnt) = wkPKG(j, 1)
                actList(11, cnt) = wkPKG(j, 3)
                actList(13, cnt) = wkPKG(j, 5)
            End If
        Next
    Next

    ReDim temp(1 To UBound(actList, 2), 1 To UBound(actList, 1))
    For i = LBound(actList, 2) To UBound(actList, 2)
        For j = LBound(actList, 1) To UBound(actList, 1)
            temp(i, j) = actList(j, i)
        Next
    Next
    actList = temp
    .Range("a6").Resize(UBound(actList, 1), UBound(actList, 2)) = actList
End With

End Sub
