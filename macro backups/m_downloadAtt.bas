Attribute VB_Name = "m_downloadAtt"
Option Explicit

Sub DownloadAttachments()
    Dim olApp As Outlook.Application
    Dim olNs As Outlook.Namespace
    Dim olFolder As Outlook.MAPIFolder
    Dim olAccount As Outlook.Account
    Dim olMail As Outlook.MailItem
    Dim olAtt As Outlook.Attachment
    Dim saveFolder As String
    Dim savePathMP As String
    Dim savePathVFACT As String
    Dim keyword As String
    Dim dateToday As Date
    Dim fso As FileSystemObject
    Dim fpath As String, fpath2 As String, fd As Folder, subfd As Folder, subfdx As Folder
    Dim mps As Integer, vfacts As Integer
    Dim reportList As Variant
    Dim currentReport As String
    Dim savePath As String
    Dim i, j As Integer
    
    reportList = Worksheets("FILENAME").Range("A1").CurrentRegion.Value
    Set fso = CreateObject("scripting.filesystemobject")
    
    ' 设置基础路径
    fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\RECEIVE"
    fpath2 = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\GCC EGPC Project Level 3 Schedule Breakdown\Construction Teams"
    
    ' 创建当日文件夹
    If Not fso.FolderExists(fpath & "\MP\" & Format(Date, "yyyymmdd")) Then
        VBA.MkDir fpath & "\MP\" & Format(Date, "yyyymmdd")
    End If
    If Not fso.FolderExists(fpath & "\VFACT\" & Format(Date - 1, "yyyymmdd")) Then
        VBA.MkDir fpath & "\VFACT\" & Format(Date - 1, "yyyymmdd")
    End If
    
    ' 设置路径和关键词
    keyword = "MW-"
    savePathMP = fpath & "\MP\" & Format(Date, "yyyymmdd") & "\"
    savePathVFACT = fpath & "\VFACT\" & Format(Date - 1, "yyyymmdd") & "\"
    dateToday = Date
    
    ' 初始化Outlook对象
    Set olApp = New Outlook.Application
    Set olNs = olApp.GetNamespace("MAPI")
    
    ' 遍历所有指定邮箱
    For Each olAccount In olNs.Accounts
        If olAccount.DisplayName = "xieguangjie@cc7.cn" Or _
           olAccount.DisplayName = "Frailove@outlook.com" Or _
           olAccount.DisplayName = "liyuansen@cc7.cn" Then
           
            Set olFolder = olAccount.DeliveryStore.GetDefaultFolder(olFolderInbox)
            
            ' 反向遍历邮件（从最新到最旧）
            For i = olFolder.Items.Count To 1 Step -1
                If olFolder.Items(i).Class = 43 Then
                    Set olMail = olFolder.Items(i)
                    
                    ' 只处理包含关键词且当天发送的邮件
                    If InStr(1, olMail.Subject, keyword) > 0 And _
                       olMail.SentOn >= dateToday Then
                       
                        ' 遍历所有附件
                        For Each olAtt In olMail.Attachments
                            ' 遍历报告列表进行匹配
                            For j = 2 To UBound(reportList, 1)
                                currentReport = reportList(j, 1)
                                
                                ' 确定保存路径
                                savePath = ""
                                If InStr(1, olAtt.Filename, "MW-" & currentReport & "_MP") > 0 Then
                                    savePath = savePathMP & olAtt.Filename
                                ElseIf InStr(1, olAtt.Filename, "MW-" & currentReport & "_VFACT") > 0 Then
                                    savePath = savePathVFACT & olAtt.Filename
                                ElseIf currentReport = Left(olAtt.Filename, 3) Then
                                    savePath = fpath2 & "\" & olAtt.Filename
                                End If
                                
                                ' 保存附件（如果不存在）
                                If savePath <> "" Then
                                    If Not fso.fileExists(savePath) Then
                                        olAtt.SaveAsFile savePath
                                    End If
                                    Exit For ' 匹配后退出内层循环
                                End If
                            Next j
                        Next olAtt
                    ElseIf olMail.SentOn < dateToday Then
                        Exit For
                    End If
                End If
            Next i
        End If
    Next olAccount
    
    ' 清理对象
    Set olAtt = Nothing
    Set olMail = Nothing
    Set olFolder = Nothing
    Set olNs = Nothing
    Set olApp = Nothing
End Sub


