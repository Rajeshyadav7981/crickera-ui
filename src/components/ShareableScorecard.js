import React, { useRef } from 'react';
import { View, Text, StyleSheet, Share, Platform } from 'react-native';
import { COLORS } from '../theme';

let ViewShot;
try { ViewShot = require('react-native-view-shot').default; } catch {}

const ShareableScorecard = React.forwardRef(({ data, children }, ref) => {
  const viewRef = ref || useRef();

  const captureAndShare = async () => {
    if (!ViewShot || Platform.OS === 'web') {
      // Fallback: share as text
      return shareAsText(data);
    }

    try {
      const uri = await viewRef.current?.capture?.();
      if (uri) {
        await Share.share({
          url: uri,
          message: buildShareText(data),
        });
      }
    } catch {
      // Fallback to text share
      await shareAsText(data);
    }
  };

  return { captureAndShare, viewRef };
});

const shareAsText = async (data) => {
  if (!data) return;
  const text = buildShareText(data);
  await Share.share({ message: text });
};

const buildShareText = (data) => {
  if (!data) return 'Match Scorecard - CreckStars';

  const innings = data.innings || [];
  const scores = innings.map(inn =>
    `${inn.batting_team_name || 'Team'}: ${inn.total_runs}/${inn.total_wickets} (${inn.total_overs} ov)`
  ).join('\n');

  const pom = data.top_performers?.player_of_match;
  const pomLine = pom ? `\nPlayer of the Match: ${pom.player_name}` : '';

  return `Match Summary\n${data.result || ''}\n${scores}${pomLine}\n\nScored on CreckStars`;
};

// Standalone scorecard image component for capture
export const ScorecardImage = React.forwardRef(({ data, style }, ref) => {
  if (!data) return null;

  const innings = data.innings || [];

  const Wrapper = ViewShot || View;
  const wrapperProps = ViewShot
    ? { ref, options: { format: 'png', quality: 0.9 } }
    : { ref };

  return (
    <Wrapper {...wrapperProps} style={[styles.card, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>CreckStars</Text>
        {data.result && <Text style={styles.result}>{data.result}</Text>}
      </View>

      {/* Innings Scores */}
      {innings.map((inn, i) => (
        <View key={i} style={styles.inningsRow}>
          <Text style={styles.teamName} numberOfLines={1}>{inn.batting_team_name}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{inn.total_runs}/{inn.total_wickets}</Text>
            <Text style={styles.overs}>({inn.total_overs} ov)</Text>
          </View>
        </View>
      ))}

      {/* Top Performers */}
      {data.top_performers && (
        <View style={styles.performers}>
          {data.top_performers.best_batsman && (
            <View style={styles.performerRow}>
              <Text style={styles.performerLabel}>Best Bat</Text>
              <Text style={styles.performerName}>
                {data.top_performers.best_batsman.player_name} - {data.top_performers.best_batsman.runs}({data.top_performers.best_batsman.balls_faced})
              </Text>
            </View>
          )}
          {data.top_performers.best_bowler && (
            <View style={styles.performerRow}>
              <Text style={styles.performerLabel}>Best Bowl</Text>
              <Text style={styles.performerName}>
                {data.top_performers.best_bowler.player_name} - {data.top_performers.best_bowler.wickets}/{data.top_performers.best_bowler.runs_conceded}
              </Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.watermark}>Scored on CreckStars</Text>
    </Wrapper>
  );
});

export { shareAsText, buildShareText };
export default ShareableScorecard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0D0D0D',
    borderRadius: 20,
    padding: 20,
    width: 340,
  },
  header: { marginBottom: 16, alignItems: 'center' },
  appName: { fontSize: 18, fontWeight: '900', color: COLORS.ACCENT, letterSpacing: 1 },
  result: { fontSize: 13, fontWeight: '700', color: COLORS.SUCCESS, marginTop: 8, textAlign: 'center' },
  inningsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER,
  },
  teamName: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT, flex: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  score: { fontSize: 22, fontWeight: '900', color: COLORS.TEXT },
  overs: { fontSize: 12, color: COLORS.TEXT_MUTED },
  performers: { marginTop: 14 },
  performerRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  performerLabel: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, width: 60 },
  performerName: { fontSize: 12, fontWeight: '600', color: COLORS.TEXT_SECONDARY, flex: 1 },
  watermark: { fontSize: 9, color: COLORS.TEXT_HINT, textAlign: 'center', marginTop: 14 },
});
