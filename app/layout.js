export const metadata = {
  title: 'Mastercraft Shop Management',
  description: 'Mobile-first labor, material, and scheduling prototype'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
