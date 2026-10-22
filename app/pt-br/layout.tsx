import PortugueseDocumentLanguage from '@/components/shared/PortugueseDocumentLanguage';

export default function PortugueseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div lang="pt-BR">
      <PortugueseDocumentLanguage />
      {children}
    </div>
  );
}
