import {Address} from '@stellar/stellar-sdk';

    /**
 * Union: DataKey
 */
 export type DataKey =
  { tag: "Admin"; values: void } |
  { tag: "Token"; values: void } |
  { tag: "TargetAmount"; values: void } |
  { tag: "Deadline"; values: void } |
  { tag: "MilestoneCount"; values: void } |
  { tag: "CurrentMilestone"; values: void } |
  { tag: "ProjectState"; values: void } |
  { tag: "DonorAmount"; values: readonly [string] } |
  { tag: "DonorVoted"; values: readonly [string] } |
  { tag: "YesVotes"; values: void } |
  { tag: "NoVotes"; values: void } |
  { tag: "ProofUrl"; values: void } |
  { tag: "TotalPledged"; values: void };

/**
 * Enum: ProjectState
 */
export enum ProjectState {
  /**
   * Enum Case: Funding
   */
  Funding = 0,
  /**
   * Enum Case: Voting
   */
  Voting = 1,
  /**
   * Enum Case: Completed
   */
  Completed = 2,
  /**
   * Enum Case: Failed
   */
  Failed = 3
}
    