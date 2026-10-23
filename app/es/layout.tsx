import PortugueseDocumentLanguage from '@/components/shared/PortugueseDocumentLanguage';
import '../pt-br/pt-br.css';

export default function SpanishLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div lang="es" className="ptbr-site">
      <PortugueseDocumentLanguage language="es" />
      {children}
    </div>
  );
}
