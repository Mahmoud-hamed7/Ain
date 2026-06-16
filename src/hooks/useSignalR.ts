/**
 * useSignalR — Hook for consuming the SignalR hub connection context.
 *
 * Re-exports the hook from SignalRProvider for a clean import path:
 *   import { useSignalR } from '../hooks/useSignalR';
 *
 * Returns:
 *  - connection:           The raw HubConnection (or null before connect)
 *  - connectionState:      'Connected' | 'Reconnecting' | 'Disconnected'
 *  - isConnected:          boolean shorthand
 *  - joinCommunityGroup:   Invoke JoinCommunityGroup(communityId)
 *  - leaveCommunityGroup:  Invoke LeaveCommunityGroup(communityId)
 */
export { useSignalR, type SignalRContextType } from '../providers/SignalRProvider';
