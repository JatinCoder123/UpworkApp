import logoUrl from '../assets/logo.png'

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('Could not load the logo'))
  image.src = src
})

const fileName = (title) => `${String(title || 'cover-letter').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'cover-letter'}-cover-letter.pdf`

// Builds an A4 PDF with the company logo on top and the letter text below, then downloads it.
export async function downloadCoverLetterPdf(letter, title) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), loadImage(logoUrl)])
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const margin = 56
  const lineHeight = 16

  pdf.addImage(logo, 'PNG', margin, margin - 8, 44, 44)
  pdf.setFont('helvetica', 'bold').setFontSize(14).setTextColor(20, 20, 20)
  pdf.text('Outright Systems', margin + 56, margin + 20)
  pdf.setDrawColor(220, 220, 220).setLineWidth(0.75).line(margin, margin + 52, width - margin, margin + 52)

  pdf.setFont('helvetica', 'normal').setFontSize(11).setTextColor(40, 40, 40)
  let y = margin + 84
  for (const line of pdf.splitTextToSize(letter.trim(), width - margin * 2)) {
    if (y > height - margin) { pdf.addPage(); y = margin }
    pdf.text(line, margin, y)
    y += lineHeight
  }

  pdf.save(fileName(title))
}
