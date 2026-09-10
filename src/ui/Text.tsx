import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { colors } from '@/theme/colors';
import { fontFamily, fontSize, lineHeight } from '@/theme/type';

interface TextProps extends RNTextProps {
  color?: string;
}

/**
 * Display — Fraunces, screen titles (34pt).
 * Title   — Fraunces SemiBold, section headers / localized common name (26pt).
 * Latin   — Fraunces italic, the Latin binomial (16pt, moss — see theme/colors.ts's contrast note).
 * Body    — Archivo, body text (16pt, line height ×1.5).
 * Caption — Archivo, secondary text (14pt).
 * Micro   — Archivo, attribution/footer text (12pt).
 */
export function Display({ style, color, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        { fontFamily: fontFamily.displayRegular, fontSize: fontSize.display, color: color ?? colors.ink },
        style,
      ]}
    />
  );
}

export function Title({ style, color, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.title, color: color ?? colors.ink },
        style,
      ]}
    />
  );
}

export function Latin({ style, color, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily: fontFamily.displayItalic,
          fontSize: fontSize.subtitle,
          color: color ?? colors.moss,
        },
        style,
      ]}
    />
  );
}

export function Body({ style, color, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily: fontFamily.bodyRegular,
          fontSize: fontSize.body,
          lineHeight: lineHeight(fontSize.body),
          color: color ?? colors.ink,
        },
        style,
      ]}
    />
  );
}

export function Caption({ style, color, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.caption, color: color ?? colors.ink },
        style,
      ]}
    />
  );
}

export function Micro({ style, color, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        { fontFamily: fontFamily.bodyRegular, fontSize: fontSize.micro, color: color ?? colors.ink },
        style,
      ]}
    />
  );
}
