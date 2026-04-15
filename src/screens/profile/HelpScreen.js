import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme';
import BackButton from '../../components/BackButton';

const FAQ_ITEMS = [
  {
    q: 'How do I create a match?',
    a: 'Go to Home tab and tap "Create Match". Fill in the details like teams, overs, and venue. You can also use Quick Match for faster setup.',
  },
  {
    q: 'How do I add players to a team?',
    a: 'Go to your team detail page and tap "Add Player". You can search for existing players or create new ones.',
  },
  {
    q: 'How does live scoring work?',
    a: 'After completing the toss and setting squads, tap "Start Scoring". Score each ball by selecting runs, extras, or wickets. The scorecard updates in real-time.',
  },
  {
    q: 'How do I create a tournament?',
    a: 'Go to the Tournaments tab and tap the "+" button. Set up tournament name, type (league/knockout), add teams, and generate matches.',
  },
  {
    q: 'Can others view my match live?',
    a: 'Yes! Share the match code with others. They can search and follow the match in real-time from the Community or Home tab.',
  },
];

const HelpScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [expandedIdx, setExpandedIdx] = useState(null);

  const toggleFaq = (idx) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* FAQ Section */}
        <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>
        <View style={styles.card}>
          {FAQ_ITEMS.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.faqRow}
                onPress={() => toggleFaq(idx)}
                activeOpacity={0.7}
              >
                <Text style={styles.faqQuestion}>{item.q}</Text>
                <Text style={styles.faqArrow}>{expandedIdx === idx ? '\u2303' : '\u2304'}</Text>
              </TouchableOpacity>
              {expandedIdx === idx && (
                <View style={styles.faqAnswerWrap}>
                  <Text style={styles.faqAnswer}>{item.a}</Text>
                </View>
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Contact Section */}
        <Text style={styles.sectionLabel}>Contact Us</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL('mailto:support@creckstars.com')}
          >
            <Text style={styles.contactIcon}>{'\u2709'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>Email Support</Text>
              <Text style={styles.contactDesc}>support@creckstars.com</Text>
            </View>
            <Text style={styles.faqArrow}>{'\u203A'}</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>CrecKStars v1.0.0</Text>
          <Text style={styles.appInfoText}>Made with {'\u2764'} for cricket</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: COLORS.CARD,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: COLORS.TEXT, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  content: { padding: 20, paddingBottom: 40 },

  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginBottom: 8, marginTop: 16 },
  card: {
    backgroundColor: COLORS.CARD, borderRadius: 14, borderWidth: 1, borderColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: COLORS.BORDER, marginLeft: 16 },

  faqRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  faqQuestion: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT, flex: 1, marginRight: 8 },
  faqArrow: { fontSize: 18, color: COLORS.TEXT_SECONDARY },
  faqAnswerWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  faqAnswer: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 20 },

  contactRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
  },
  contactIcon: { fontSize: 20, marginRight: 12 },
  contactTitle: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  contactDesc: { fontSize: 12, color: COLORS.ACCENT, marginTop: 2 },

  appInfo: { alignItems: 'center', marginTop: 32 },
  appInfoText: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 4 },
});

export default HelpScreen;
