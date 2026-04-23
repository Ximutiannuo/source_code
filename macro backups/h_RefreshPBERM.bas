Attribute VB_Name = "h_RefreshPBERM"
Sub RefreshQueryP6Export()
Dim ws As Worksheet
Dim qt As QueryTable

Set ws = ThisWorkbook.Sheets("Activity(C_P6)")
Set qt = ws.ListObjects("CON").QueryTable
qt.BackgroundQuery = False
qt.Refresh
startTime = Timer

Do
    If Timer - startTime > 10 Then
        Exit Do
    End If
    If Not qt.Refreshing Then
        Exit Do
    End If
    Application.Wait Now + TimeValue("0:00:01")
    DoEvents
Loop
ws.Calculate
DoEvents


RefreshActivityCfromP6
MsgBox "Step 1 Completed - Refresh PQ from P6 Activities!"

End Sub


Sub RefreshQueryFiles()
     Dim ws As Worksheet
    Dim qt As QueryTable
    
    Set ws = ThisWorkbook.Sheets("UpdateQuantity")
    Set qt = ws.ListObjects("RSC_Define").QueryTable
    qt.BackgroundQuery = False
    
    qt.Refresh
    startTime = Timer
    
    Do
        If Timer - startTime > 10 Then
            Exit Do
        End If
        If Not qt.Refreshing Then
            Exit Do
        End If
        Application.Wait Now + TimeValue("0:00:01")
        DoEvents
    Loop
    ws.Calculate
    DoEvents
    
    
    RefreshQueryConstruction_Teams
    MsgBox "Step 2 Completed - Refresh PQ from Files (resource & status)!"
    
End Sub



Sub RefreshQueryERM()
    Dim ws As Worksheet
    Dim qt As QueryTable
    
    Set ws = ThisWorkbook.Sheets("Act_ERM")
    Set qt = ws.ListObjects("Act_ERM").QueryTable
    qt.BackgroundQuery = False
    qt.Refresh
    startTime = Timer
    
    Do
        If Timer - startTime > 10 Then
            Exit Do
        End If
        
        If Not qt.Refreshing Then
            Exit Do
        End If
        
        Application.Wait Now + TimeValue("0:00:01")
    Loop
    ws.Calculate
    DoEvents
    MsgBox "Refresh PQ from ERM!"
End Sub
Sub RefreshQueryP6Export_e()
Dim ws As Worksheet
Dim qt As QueryTable

Set ws = ThisWorkbook.Sheets("Activity(E_P6)")
Set qt = ws.ListObjects("P6ENGDB").QueryTable
qt.BackgroundQuery = False
qt.Refresh
startTime = Timer

Do
    If Timer - startTime > 10 Then
        Exit Do
    End If
    If Not qt.Refreshing Then
        Exit Do
    End If
    Application.Wait Now + TimeValue("0:00:01")
    DoEvents
Loop
ws.Calculate
DoEvents

updateDWG
WriteENGtoP6
MsgBox "ENG activity refreshed and ready to import to P6!"
End Sub

Sub RefreshQueryConstruction_Teams()
Dim ws As Worksheet
Dim qt As QueryTable

Set ws = ThisWorkbook.Sheets("Activity List( from TEAMs)")
Set qt = ws.ListObjects("Construction_Teams").QueryTable
qt.BackgroundQuery = False
qt.Refresh
startTime = Timer

Do
    If Timer - startTime > 10 Then
        Exit Do
    End If
    If Not qt.Refreshing Then
        Exit Do
    End If
    Application.Wait Now + TimeValue("0:00:01")
    DoEvents
Loop
ws.Calculate
DoEvents
RefreshQueryConstruction_Teams_QTY
End Sub

Sub RefreshQueryConstruction_Teams_QTY()
Dim ws As Worksheet
Dim qt As QueryTable

Set ws = ThisWorkbook.Sheets("ConsQuantityControl")
Set qt = ws.ListObjects("ConsQuantityControl").QueryTable
qt.BackgroundQuery = False
qt.Refresh
startTime = Timer

Do
    If Timer - startTime > 10 Then
        Exit Do
    End If
    If Not qt.Refreshing Then
        Exit Do
    End If
    Application.Wait Now + TimeValue("0:00:01")
    DoEvents
Loop
ws.Calculate
DoEvents
End Sub

