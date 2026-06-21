import { describe, expect, it } from 'vitest';
import { parseRegenerateCodeResponse } from './community';

describe('parseRegenerateCodeResponse', () => {
  it('maps newInviteCode from API to inviteCode alias', () => {
    const result = parseRegenerateCodeResponse({
      communityId: '6989f65a-3398-4c38-ae0d-e080823c9df5',
      newInviteCode: 'MA9X5E',
    });
    expect(result.newInviteCode).toBe('MA9X5E');
    expect(result.inviteCode).toBe('MA9X5E');
    expect(result.communityId).toBe('6989f65a-3398-4c38-ae0d-e080823c9df5');
  });
});
