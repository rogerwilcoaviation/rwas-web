import PortugueseDocumentLanguage from '@/components/shared/PortugueseDocumentLanguage';
import './pt-br.css';

export default function PortugueseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div lang="pt-BR" className="ptbr-site">
      <PortugueseDocumentLanguage />
      {children}
    </div>
  );
}
