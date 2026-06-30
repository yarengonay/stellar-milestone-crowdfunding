#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, String, token};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracttype]
pub enum ProjectState {
    Funding = 0,
    Voting = 1,
    Completed = 2,
    Failed = 3,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    TargetAmount,
    Deadline,
    MilestoneCount,
    CurrentMilestone,
    ProjectState,
    DonorAmount(Address),
    DonorVoted(Address),
    YesVotes,
    NoVotes,
    ProofUrl,
    TotalPledged,
}

#[contract]
pub struct MilestoneCrowdfunding;

#[contractimpl]
impl MilestoneCrowdfunding {
    // Initializes the crowdfunding campaign
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        target: i128,
        deadline: u64,
        milestones: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        if target <= 0 {
            panic!("Target amount must be positive");
        }
        if milestones == 0 {
            panic!("Milestone count must be greater than zero");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TargetAmount, &target);
        env.storage().instance().set(&DataKey::Deadline, &deadline);
        env.storage().instance().set(&DataKey::MilestoneCount, &milestones);
        env.storage().instance().set(&DataKey::CurrentMilestone, &0u32);
        env.storage().instance().set(&DataKey::ProjectState, &ProjectState::Funding);
        env.storage().instance().set(&DataKey::YesVotes, &0i128);
        env.storage().instance().set(&DataKey::NoVotes, &0i128);
        env.storage().instance().set(&DataKey::TotalPledged, &0i128);
    }

    // Pledges tokens to the crowdfunding campaign
    pub fn pledge(env: Env, donor: Address, amount: i128) {
        donor.require_auth();

        let state = env.storage().instance().get::<_, ProjectState>(&DataKey::ProjectState).unwrap();
        if state != ProjectState::Funding {
            panic!("Campaign is not in funding state");
        }

        let deadline = env.storage().instance().get::<_, u64>(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() >= deadline {
            panic!("Deadline has passed");
        }

        if amount <= 0 {
            panic!("Pledge amount must be positive");
        }

        let token_addr = env.storage().instance().get::<_, Address>(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        // Transfer funds from donor to this contract
        token_client.transfer(&donor, &env.current_contract_address(), &amount);

        // Record donor contribution
        let key = DataKey::DonorAmount(donor.clone());
        let current_pledged = env.storage().instance().get::<_, i128>(&key).unwrap_or(0);
        let new_pledged = current_pledged + amount;
        env.storage().instance().set(&key, &new_pledged);

        let total_pledged_key = DataKey::TotalPledged;
        let total_pledged = env.storage().instance().get::<_, i128>(&total_pledged_key).unwrap_or(0) + amount;
        env.storage().instance().set(&total_pledged_key, &total_pledged);

        // Emit pledge event
        env.events().publish(
            (symbol_short!("pledge"), donor),
            (amount, total_pledged)
        );
    }

    // Project owner submits proof of completing a milestone
    pub fn submit_proof(env: Env, proof_url: String) {
        let admin = env.storage().instance().get::<_, Address>(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut state = env.storage().instance().get::<_, ProjectState>(&DataKey::ProjectState).unwrap();
        let total_pledged = env.storage().instance().get::<_, i128>(&DataKey::TotalPledged).unwrap_or(0);
        let target = env.storage().instance().get::<_, i128>(&DataKey::TargetAmount).unwrap();

        // If deadline passed or target reached, transition check
        if state == ProjectState::Funding {
            if total_pledged < target {
                let deadline = env.storage().instance().get::<_, u64>(&DataKey::Deadline).unwrap();
                if env.ledger().timestamp() >= deadline {
                    // Target not met and deadline passed -> Failed
                    env.storage().instance().set(&DataKey::ProjectState, &ProjectState::Failed);
                    panic!("Campaign failed: target not met before deadline");
                } else {
                    panic!("Cannot submit proof: funding target not yet met");
                }
            }
            // Target is met, transition to voting
            state = ProjectState::Voting;
            env.storage().instance().set(&DataKey::ProjectState, &ProjectState::Voting);
        }

        if state != ProjectState::Voting {
            panic!("Campaign is not in voting state");
        }

        let current_milestone = env.storage().instance().get::<_, u32>(&DataKey::CurrentMilestone).unwrap();
        let milestone_count = env.storage().instance().get::<_, u32>(&DataKey::MilestoneCount).unwrap();

        if current_milestone >= milestone_count {
            panic!("All milestones already completed");
        }

        // Save proof url and reset votes
        env.storage().instance().set(&DataKey::ProofUrl, &proof_url);
        env.storage().instance().set(&DataKey::YesVotes, &0i128);
        env.storage().instance().set(&DataKey::NoVotes, &0i128);

        // Clear all donor voted flags by not resetting the map (since we can't easily iterate over storage, we can use a voting round ID or current_milestone index in DonorVoted key)
        // Let's modify the key to include the milestone index to avoid resetting a map: DonorVoted(Address, u32)
        env.events().publish(
            (symbol_short!("proof_sub"), current_milestone),
            proof_url
        );
    }

    // Donors vote on the submitted milestone proof
    pub fn vote(env: Env, donor: Address, approve: bool) {
        donor.require_auth();

        let state = env.storage().instance().get::<_, ProjectState>(&DataKey::ProjectState).unwrap();
        if state != ProjectState::Voting {
            panic!("Campaign is not in voting state");
        }

        let current_milestone = env.storage().instance().get::<_, u32>(&DataKey::CurrentMilestone).unwrap();
        let donor_pledge = env.storage().instance().get::<_, i128>(&DataKey::DonorAmount(donor.clone())).unwrap_or(0);

        if donor_pledge <= 0 {
            panic!("Only donors can vote");
        }

        // Check if donor has already voted for this specific milestone
        let vote_key = DataKey::DonorVoted(donor.clone());
        if env.storage().instance().has(&vote_key) {
            let last_voted_milestone = env.storage().instance().get::<_, u32>(&vote_key).unwrap();
            if last_voted_milestone == current_milestone {
                panic!("Donor already voted for this milestone");
            }
        }

        // Record vote
        env.storage().instance().set(&vote_key, &current_milestone);

        if approve {
            let yes_votes = env.storage().instance().get::<_, i128>(&DataKey::YesVotes).unwrap_or(0) + donor_pledge;
            env.storage().instance().set(&DataKey::YesVotes, &yes_votes);
        } else {
            let no_votes = env.storage().instance().get::<_, i128>(&DataKey::NoVotes).unwrap_or(0) + donor_pledge;
            env.storage().instance().set(&DataKey::NoVotes, &no_votes);
        }

        env.events().publish(
            (symbol_short!("vote"), donor),
            (approve, donor_pledge)
        );
    }

    // Tallies the vote and releases funds for the milestone if approved
    pub fn resolve_milestone(env: Env) {
        let state = env.storage().instance().get::<_, ProjectState>(&DataKey::ProjectState).unwrap();
        if state != ProjectState::Voting {
            panic!("Campaign is not in voting state");
        }

        let yes_votes = env.storage().instance().get::<_, i128>(&DataKey::YesVotes).unwrap_or(0);
        let no_votes = env.storage().instance().get::<_, i128>(&DataKey::NoVotes).unwrap_or(0);
        let total_pledged = env.storage().instance().get::<_, i128>(&DataKey::TotalPledged).unwrap_or(0);

        if yes_votes + no_votes == 0 {
            panic!("No votes have been cast yet");
        }

        let current_milestone = env.storage().instance().get::<_, u32>(&DataKey::CurrentMilestone).unwrap();
        let milestone_count = env.storage().instance().get::<_, u32>(&DataKey::MilestoneCount).unwrap();
        let admin = env.storage().instance().get::<_, Address>(&DataKey::Admin).unwrap();
        let token_addr = env.storage().instance().get::<_, Address>(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        if yes_votes > no_votes {
            // Milestone approved! Release milestone funds.
            let share = total_pledged / (milestone_count as i128);
            
            // Transfer share to admin
            token_client.transfer(&env.current_contract_address(), &admin, &share);

            let next_milestone = current_milestone + 1;
            env.storage().instance().set(&DataKey::CurrentMilestone, &next_milestone);

            if next_milestone >= milestone_count {
                env.storage().instance().set(&DataKey::ProjectState, &ProjectState::Completed);
            } else {
                // Return to voting state but need to submit proof first
                env.storage().instance().set(&DataKey::ProjectState, &ProjectState::Voting);
            }

            env.events().publish(
                (symbol_short!("approved"), current_milestone),
                share
            );
        } else {
            // Milestone rejected! Set project to Failed, allowing donors to refund remaining funds.
            env.storage().instance().set(&DataKey::ProjectState, &ProjectState::Failed);

            env.events().publish(
                (symbol_short!("rejected"), current_milestone),
                0i128
            );
        }

    }

    // Allows donors to retrieve their refund if the campaign fails
    pub fn refund(env: Env, donor: Address) {
        donor.require_auth();

        let state = env.storage().instance().get::<_, ProjectState>(&DataKey::ProjectState).unwrap();
        if state != ProjectState::Failed {
            // Check if deadline has passed and target was not met
            let deadline = env.storage().instance().get::<_, u64>(&DataKey::Deadline).unwrap();
            let total_pledged = env.storage().instance().get::<_, i128>(&DataKey::TotalPledged).unwrap_or(0);
            let target = env.storage().instance().get::<_, i128>(&DataKey::TargetAmount).unwrap();
            
            if env.ledger().timestamp() >= deadline && total_pledged < target {
                env.storage().instance().set(&DataKey::ProjectState, &ProjectState::Failed);
            } else {
                panic!("Campaign is not in failed state");
            }
        }

        let key = DataKey::DonorAmount(donor.clone());
        let pledged_amount = env.storage().instance().get::<_, i128>(&key).unwrap_or(0);

        if pledged_amount <= 0 {
            panic!("No pledged funds to refund");
        }

        let current_milestone = env.storage().instance().get::<_, u32>(&DataKey::CurrentMilestone).unwrap();
        let milestone_count = env.storage().instance().get::<_, u32>(&DataKey::MilestoneCount).unwrap();
        
        // Calculate remaining share for this donor
        let remaining_milestones = milestone_count - current_milestone;
        let refund_amount = (pledged_amount * (remaining_milestones as i128)) / (milestone_count as i128);

        if refund_amount > 0 {
            let token_addr = env.storage().instance().get::<_, Address>(&DataKey::Token).unwrap();
            let token_client = token::Client::new(&env, &token_addr);
            token_client.transfer(&env.current_contract_address(), &donor, &refund_amount);
        }

        env.storage().instance().set(&key, &0i128);

        env.events().publish(
            (symbol_short!("refund"), donor),
            refund_amount
        );
    }

    // --- View Functions ---

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get::<_, Address>(&DataKey::Admin).unwrap()
    }

    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get::<_, Address>(&DataKey::Token).unwrap()
    }

    pub fn get_target(env: Env) -> i128 {
        env.storage().instance().get::<_, i128>(&DataKey::TargetAmount).unwrap()
    }

    pub fn get_deadline(env: Env) -> u64 {
        env.storage().instance().get::<_, u64>(&DataKey::Deadline).unwrap()
    }

    pub fn get_milestone_count(env: Env) -> u32 {
        env.storage().instance().get::<_, u32>(&DataKey::MilestoneCount).unwrap()
    }

    pub fn get_current_milestone(env: Env) -> u32 {
        env.storage().instance().get::<_, u32>(&DataKey::CurrentMilestone).unwrap()
    }

    pub fn get_state(env: Env) -> ProjectState {
        env.storage().instance().get::<_, ProjectState>(&DataKey::ProjectState).unwrap_or(ProjectState::Funding)
    }

    pub fn get_donor_amount(env: Env, donor: Address) -> i128 {
        env.storage().instance().get::<_, i128>(&DataKey::DonorAmount(donor)).unwrap_or(0)
    }

    pub fn get_votes(env: Env) -> (i128, i128) {
        let yes = env.storage().instance().get::<_, i128>(&DataKey::YesVotes).unwrap_or(0);
        let no = env.storage().instance().get::<_, i128>(&DataKey::NoVotes).unwrap_or(0);
        (yes, no)
    }

    pub fn get_total_pledged(env: Env) -> i128 {
        env.storage().instance().get::<_, i128>(&DataKey::TotalPledged).unwrap_or(0)
    }

    pub fn get_proof_url(env: Env) -> String {
        env.storage().instance().get::<_, String>(&DataKey::ProofUrl).unwrap()
    }
}

mod test;

