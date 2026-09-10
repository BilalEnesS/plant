import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/ui/Screen';
import { Body, Caption, Latin, Micro, Title } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { colors } from '@/theme/colors';
import { spacing, radius, TOUCH_MIN } from '@/theme/layout';
import { fontFamily, fontSize, lineHeight } from '@/theme/type';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { useCopy } from '@/copy/useCopy';
import { discoveries } from '@/db/discoveries';
import { chatMessages, type ChatMessage } from '@/db/chat';
import { appendUserMessage, requestReply, MAX_MESSAGE_LENGTH } from '@/services/chat';
import { messageFor } from '@/errors/AppError';
import type { Discovery } from '@/db/types';

/**
 * Per-plant chat. Every thread is scoped to one discovery and grounded in
 * that record's stored facts (see buildChatSystemPrompt) — it is not a
 * general assistant that happens to live in a plant app.
 *
 * The thread is persisted in SQLite, so returning to a plant weeks later
 * brings its conversation back, and deleting the plant deletes the chat.
 */
export default function PlantChatScreen() {
  const tr = useCopy();
  const locale = useLocaleStore((s) => s.locale);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const storeItem = useCollectionStore((s) => s.items.find((i) => i.id === id));

  const [fallbackItem, setFallbackItem] = useState<Discovery | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  /**
   * The `sending` state is still false for the rest of the tick it's set in,
   * so a fast double-tap could slip past it and both persist a duplicate
   * question and bill a second API call. A ref flips synchronously.
   */
  const inFlight = useRef(false);

  const item = storeItem ?? fallbackItem;

  useEffect(() => {
    if (!storeItem && id) discoveries.getById(id).then(setFallbackItem);
  }, [storeItem, id]);

  useEffect(() => {
    if (id) chatMessages.listByDiscovery(id).then(setMessages);
  }, [id]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || inFlight.current || !item) return;

    inFlight.current = true;
    setError(null);
    setInput('');
    setSending(true);

    try {
      // Persist the question before calling the model, so a failed request
      // leaves it in the thread and "retry" never means retyping.
      const userMessage = await appendUserMessage(item.id, trimmed);
      const withUser = [...messages, userMessage];
      setMessages(withUser);

      const outcome = await requestReply({ discovery: item, history: withUser, locale });
      if (outcome.kind === 'reply') {
        setMessages((prev) => [...prev, outcome.message]);
      } else {
        setError(messageFor(outcome.error));
      }
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  }

  /** Re-asks the model with the thread as-is — the question is already saved. */
  async function retry() {
    if (inFlight.current || !item || messages.length === 0) return;

    inFlight.current = true;
    setError(null);
    setSending(true);

    try {
      const outcome = await requestReply({ discovery: item, history: messages, locale });
      if (outcome.kind === 'reply') {
        setMessages((prev) => [...prev, outcome.message]);
      } else {
        setError(messageFor(outcome.error));
      }
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  }

  async function clearThread() {
    if (!item) return;
    await chatMessages.clearByDiscovery(item.id);
    setMessages([]);
    setError(null);
  }

  if (!item) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Body>{tr.recordNotFound}</Body>
          <Button label={tr.close} variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const suggestions = [tr.chatSuggestionWater, tr.chatSuggestionLight, tr.chatSuggestionPets];
  const canSend = input.trim().length > 0 && !sending;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Title style={styles.headerTitle} numberOfLines={1}>
            {item.speciesCommonTr ?? item.speciesLatin}
          </Title>
          <Latin style={styles.headerLatin} numberOfLines={1}>
            {item.speciesLatin}
          </Latin>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.close}
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.headerButton}
        >
          <Caption color={colors.moss}>{tr.close}</Caption>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            messages.length === 0 ? (
              <View style={styles.introBlock}>
                <Body color={colors.moss} style={styles.introText}>
                  {tr.chatIntro}
                </Body>
                <View style={styles.suggestions}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={s}
                      accessibilityRole="button"
                      onPress={() => ask(s)}
                      disabled={sending}
                      style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                    >
                      <Caption color={colors.moss}>{s}</Caption>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          renderItem={({ item: message }) => (
            <View
              style={[
                styles.bubble,
                message.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Body color={message.role === 'user' ? colors.paper : colors.ink}>
                {message.content}
              </Body>
            </View>
          )}
          ListFooterComponent={
            <View>
              {sending && (
                <View style={[styles.bubble, styles.bubbleAssistant, styles.thinking]}>
                  <ActivityIndicator size="small" color={colors.moss} />
                  <Caption color={colors.moss}>{tr.chatThinking}</Caption>
                </View>
              )}
              {error && (
                <View style={styles.errorBox}>
                  <Caption color={colors.signal} style={styles.errorText}>
                    {error}
                  </Caption>
                  <Button label={tr.retry} variant="secondary" onPress={retry} />
                </View>
              )}
            </View>
          }
        />

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={tr.chatPlaceholder}
            placeholderTextColor={colors.moss}
            maxLength={MAX_MESSAGE_LENGTH}
            multiline
            editable={!sending}
            style={styles.input}
            onSubmitEditing={() => ask(input)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.chatSendA11y}
            accessibilityState={{ disabled: !canSend }}
            onPress={() => ask(input)}
            disabled={!canSend}
            style={[styles.sendButton, !canSend && styles.sendDisabled]}
          >
            <View style={styles.sendGlyph} />
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Micro color={colors.moss} style={styles.disclaimer}>
            {tr.chatDisclaimer}
          </Micro>
          {messages.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={clearThread}
              hitSlop={8}
              style={styles.clearButton}
            >
              <Micro color={colors.moss}>{tr.chatClear}</Micro>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(6),
    paddingTop: spacing(3),
    paddingBottom: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
  },
  headerLatin: {
    fontSize: 13,
  },
  headerButton: {
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
  },
  thread: {
    padding: spacing(6),
    gap: spacing(3),
  },
  introBlock: {
    gap: spacing(4),
    paddingBottom: spacing(2),
  },
  introText: {
    textAlign: 'center',
  },
  // Starter chips do double duty: they remove the blank-page problem, and
  // they steer the first question toward what this assistant can actually
  // answer well (care) instead of what it must refuse (diagnosis).
  suggestions: {
    gap: spacing(2),
  },
  suggestion: {
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pressed: {
    opacity: 0.6,
  },
  bubble: {
    maxWidth: '86%',
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: radius.lg,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.moss,
    borderBottomRightRadius: radius.sm,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.hairline,
    borderBottomLeftRadius: radius.sm,
  },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  errorBox: {
    marginTop: spacing(4),
    gap: spacing(3),
  },
  errorText: {
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing(3),
    paddingHorizontal: spacing(6),
    paddingTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  input: {
    flex: 1,
    minHeight: TOUCH_MIN,
    maxHeight: 120,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    color: colors.ink,
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.body,
    lineHeight: lineHeight(fontSize.body),
  },
  sendButton: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: radius.pill,
    backgroundColor: colors.bloom,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.4,
  },
  // A paper triangle pointing right — a send arrow without an icon package.
  sendGlyph: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.paper,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(3),
  },
  disclaimer: {
    flex: 1,
  },
  clearButton: {
    minHeight: 32,
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
  },
});
