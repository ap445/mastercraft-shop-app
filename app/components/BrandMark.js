export default function BrandMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="brand-mark">
      <path d="M12 1.4 L21 4.8 V11.3 C21 17 17 21.1 12 22.6 C7 21.1 3 17 3 11.3 V4.8 Z" fill="#c01311" stroke="#8f0d0d" strokeWidth="0.6" />
      <path d="M12 5.1 L13.3 8.55 L17 8.7 L14.08 10.95 L15.1 14.5 L12 12.4 L8.9 14.5 L9.92 10.95 L7 8.7 L10.7 8.55 Z" fill="#fff" />
    </svg>
  );
}
