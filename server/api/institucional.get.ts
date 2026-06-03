import fs from 'fs'
import path from 'path'
import institutionalData from '../institucional-data.json'

interface Document {
  slug: string
  title: string
  date: string
  description: string
  file?: string
  content: string
}

export default defineEventHandler((event) => {
  if (process.env.NODE_ENV === 'development') {
    const contentDir = path.resolve(process.cwd(), 'content/institucional')
    
    if (fs.existsSync(contentDir)) {
      const files = fs.readdirSync(contentDir)
      const documents: Document[] = []

      files.forEach((file) => {
        if (file.endsWith('.md')) {
          const filePath = path.join(contentDir, file)
          const fileContent = fs.readFileSync(filePath, 'utf-8')
          
          const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
          
          if (match) {
            const frontmatterRaw = match[1]
            const content = match[2].trim()
            
            const metadata: Record<string, string> = {}
            frontmatterRaw.split('\n').forEach((line) => {
              const parts = line.split(':')
              if (parts.length >= 2) {
                const key = parts[0].trim()
                const value = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '')
                metadata[key] = value
              }
            })
            
            const slug = file.replace(/\.md$/, '')
            
            documents.push({
              slug,
              title: metadata.title || 'Sem título',
              date: metadata.date || new Date().toISOString(),
              description: metadata.description || '',
              file: metadata.file || undefined,
              content: content
            })
          }
        }
      })

      return documents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
  }

  return institutionalData as Document[]
})
