import { Layout, Spin, Tree, Typography } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useLocation, useNavigate } from 'react-router-dom'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import 'katex/dist/katex.min.css'
import './HelpPage.css'

const docModules = import.meta.glob<string>('../docs/**/*.md', {
  query: '?raw',
  import: 'default',
})

const getDocPath = (key: string) => {
  const map: Record<string, string> = {
    'manual/platform-overview': '../docs/manual/01-platform-overview.md',
    'guide/manufacturing/architecture': '../docs/guide/manufacturing/architecture.md',
    'guide/manufacturing/mainline': '../docs/guide/manufacturing/mainline.md',
    'guide/manufacturing/excel-exchange': '../docs/guide/manufacturing/excel-exchange.md',
    'guide/tools/cad-sync': '../docs/guide/tools/cad-sync.md',
  }
  return map[key] ?? null
}

interface HelpPageProps {
  initialDocKey?: string
}

const HelpPage = ({ initialDocKey }: HelpPageProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const effectiveHash = location.hash.slice(1) || initialDocKey || 'manual/platform-overview'

  const [docKey, setDocKey] = useState(effectiveHash)
  const [docContent, setDocContent] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const treeData = useMemo<DataNode[]>(
    () => [
      {
        key: 'manual',
        title: '平台说明',
        children: [
          {
            key: 'manual/platform-overview',
            title: '平台定位与范围',
            isLeaf: true,
          },
        ],
      },
      {
        key: 'guide',
        title: '制造业务指南',
        children: [
          {
            key: 'guide/manufacturing',
            title: '制造主线',
            children: [
              {
                key: 'guide/manufacturing/architecture',
                title: '平台功能架构',
                isLeaf: true,
              },
              {
                key: 'guide/manufacturing/mainline',
                title: '设计-采购-制造主线',
                isLeaf: true,
              },
              {
                key: 'guide/manufacturing/excel-exchange',
                title: 'Excel 导入导出约定',
                isLeaf: true,
              },
            ],
          },
          {
            key: 'guide/tools',
            title: '辅助工具',
            children: [
              {
                key: 'guide/tools/cad-sync',
                title: 'CAD 自动同步',
                isLeaf: true,
              },
            ],
          },
        ],
      },
    ],
    []
  )

  const loadDoc = useCallback(async (key: string) => {
    const path = getDocPath(key)
    if (!path) {
      setDocContent('')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const loader = docModules[path]
      if (loader && typeof loader === 'function') {
        const content = await loader()
        setDocContent(typeof content === 'string' ? content : String(content))
      } else {
        setDocContent('*暂无内容*')
      }
    } catch {
      setDocContent('*加载失败*')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setDocKey(effectiveHash)
  }, [effectiveHash])

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (hash && getDocPath(hash)) {
        setDocKey(hash)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    loadDoc(docKey)
  }, [docKey, loadDoc])

  const handleSelect = (keys: React.Key[]) => {
    const key = keys[0]
    if (key && typeof key === 'string' && getDocPath(key)) {
      setDocKey(key)
      navigate(`/help#${key}`, { replace: true })
    }
  }

  const defaultExpandedKeys = useMemo(
    () => ['manual', 'guide', 'guide/manufacturing', 'guide/tools'],
    []
  )

  const selectedKeys = useMemo(() => {
    const leaf = treeData.flatMap(node => flattenKeys(node)).find(key => key === docKey)
    return leaf ? [leaf] : []
  }, [docKey, treeData])

  return (
    <Layout style={{ height: '100%', background: 'var(--bg-main)' }}>
      <Layout.Sider
        width={280}
        style={{ background: '#fff', padding: '16px 0', borderRight: '1px solid #f0f0f0' }}
      >
        <Typography.Title level={5} style={{ padding: '0 16px 12px' }}>
          平台帮助文档
        </Typography.Title>
        <Tree
          treeData={treeData}
          selectedKeys={selectedKeys}
          expandedKeys={defaultExpandedKeys}
          onSelect={handleSelect}
          blockNode
          style={{ padding: '0 8px' }}
        />
      </Layout.Sider>

      <Layout.Content style={{ padding: 24, overflow: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin size="large" />
            </div>
          ) : (
            <article
              className="help-markdown"
              style={{
                background: '#fff',
                padding: 24,
                borderRadius: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeRaw, rehypeKatex]}
              >
                {docContent}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </Layout.Content>
    </Layout>
  )
}

function flattenKeys(node: DataNode): string[] {
  const key = node.key as string
  const keys = [key]
  if (node.children) {
    node.children.forEach(child => keys.push(...flattenKeys(child)))
  }
  return keys
}

export default HelpPage
