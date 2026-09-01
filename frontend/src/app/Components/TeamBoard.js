"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Search, X, Loader2, CheckCircle, AlertCircle, RotateCcw } from "lucide-react";
import api from "@/app/api/api";
import { useAuth } from "@/app/Context/AuthContext";

// Written out in full rather than composed (`bg-${tone}-100`) because Tailwind
// only ships classes it can find as literal strings in the source.
const ROLE_TONE = {
    OWNER: "bg-orange-100 text-orange-700",
    MANAGER: "bg-[#0F253B] text-white",
    AGENT: "bg-blue-100 text-blue-700",
    FINANCE: "bg-green-100 text-green-700"
};

// Roles a team manager may hand out — must match ASSIGNABLE_ROLES in
// backend/controllers/member.controller.js. OWNER is not in the list: there is
// exactly one owner and that seat is not transferable from this screen.
const ASSIGNABLE_ROLES = ["MANAGER", "AGENT", "FINANCE"];

const STATUS_TONE = {
    ACTIVE: "bg-green-100 text-green-700",
    INVITED: "bg-yellow-100 text-yellow-700",
    SUSPENDED: "bg-red-100 text-red-700"
};

/**
 * Shared team-management surface — used by both the admin (owner) and manager
 * areas. What a user can actually do is enforced by the backend based on their
 * organization role: OWNER/MANAGER may invite/activate/suspend/delete, and
 * nobody may act on the OWNER or on their own account.
 */
export default function TeamBoard() {
    const { user } = useAuth();
    const [organizationId, setOrganizationId] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    // Failures from a per-member action (activate / suspend / role / remove) or
    // from the invite form. Kept apart from `error` so a rejected action shows
    // as a banner instead of replacing the whole team list with an error page.
    const [actionError, setActionError] = useState(null);

    const fetchMembers = async (orgId = organizationId) => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.get(`/members/${orgId}`);

            if (response && response.data && response.data.success) {
                setMembers(response.data.data || []);
            } else {
                setError(response.data?.message || "Failed to load members");
            }
        } catch (err) {
            console.error("Error fetching members:", err);
            setError(err.response?.data?.message || "Failed to load members");
        } finally {
            setLoading(false);
        }
    };

    // Get organization ID from user's member record
    useEffect(() => {
        const fetchOrgId = async () => {
            try {
                const response = await api.get("/members/my-org");
                const orgId = response.data?.data?.organization?._id;
                if (response.data.success && orgId) {
                    setOrganizationId(orgId);
                } else {
                    setError(response.data?.message || "Failed to fetch organization");
                }
            } catch (err) {
                setError(err.message || "Failed to fetch organization");
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchOrgId();
        } else {
            setLoading(false);
            setError("Please login to view team members");
        }
    }, [user]);

    // Fetch members when organizationId is available
    useEffect(() => {
        if (organizationId) {
            fetchMembers(organizationId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationId]);

    const handleInvite = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());

        try {
            setSubmitting(true);
            setActionError(null);

            const response = await api.post("/members/invite", {
                ...payload,
                organizationId
            });

            if (response.data.success) {
                setIsModalOpen(false);
                e.target.reset();
                await fetchMembers();
            } else {
                setActionError(response.data.message || "Failed to invite member");
            }
        } catch (err) {
            console.error("Error inviting member:", err);
            setActionError(err.response?.data?.message || "Failed to invite member");
        } finally {
            setSubmitting(false);
        }
    };

    // Activate covers both directions into ACTIVE: an INVITED member accepting
    // their seat, and a SUSPENDED member being reinstated.
    const handleActivate = async (memberId) => {
        try {
            setActionLoading(memberId);
            setActionError(null);
            const response = await api.patch(`/members/${memberId}/activate`);
            if (response.data.success) {
                await fetchMembers();
            }
        } catch (err) {
            setActionError(err.response?.data?.message || "Failed to activate member");
        } finally {
            setActionLoading(null);
        }
    };

    const handleSuspend = async (memberId) => {
        try {
            setActionLoading(memberId);
            setActionError(null);
            const response = await api.patch(`/members/${memberId}/suspend`);
            if (response.data.success) {
                await fetchMembers();
            }
        } catch (err) {
            setActionError(err.response?.data?.message || "Failed to suspend member");
        } finally {
            setActionLoading(null);
        }
    };

    // Move a member between MANAGER / AGENT / FINANCE. The backend rejects a
    // change to OWNER, to the owner, or to your own seat.
    const handleRoleChange = async (memberId, role) => {
        try {
            setActionLoading(memberId);
            setActionError(null);
            const response = await api.patch(`/members/${memberId}/role`, { role });
            if (response.data.success) {
                await fetchMembers();
            }
        } catch (err) {
            setActionError(err.response?.data?.message || "Failed to update role");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (memberId) => {
        if (!confirm("Are you sure you want to remove this member?")) return;

        try {
            setActionLoading(memberId);
            setActionError(null);
            const response = await api.delete(`/members/${memberId}`);
            if (response.data.success) {
                await fetchMembers();
            }
        } catch (err) {
            setActionError(err.response?.data?.message || "Failed to remove member");
        } finally {
            setActionLoading(null);
        }
    };

    const filtered = members.filter(m => {
        const search = searchQuery.toLowerCase();
        const email = m.userId?.email?.toLowerCase() || "";
        return email.includes(search);
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#F47C3C]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 rounded-2xl text-red-600">
                <h3 className="font-semibold">Error loading members</h3>
                <p>{error}</p>
                <button
                    onClick={() => fetchMembers()}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Team Members</h1>
                    <p className="text-sm text-gray-500">
                        Manage your team members
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#F47C3C] text-white rounded-xl hover:bg-[#E06D2E]"
                >
                    <Plus size={18} /> Add Member
                </button>
            </div>

            {/* Invite Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <form onSubmit={handleInvite} className="bg-white p-6 rounded-2xl w-full max-w-md">
                        <div className="flex justify-between mb-4">
                            <h2 className="text-xl font-bold">Invite Member</h2>
                            <button type="button" onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {actionError && (
                            <div className="bg-red-50 text-red-500 p-3 rounded-lg mb-4 text-sm">
                                {actionError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <input
                                name="email"
                                type="email"
                                placeholder="Email address"
                                className="w-full p-3 border rounded-lg"
                                required
                            />
                            <input
                                name="name"
                                type="text"
                                placeholder="Full name"
                                className="w-full p-3 border rounded-lg"
                                required
                            />
                            <select
                                name="role"
                                className="w-full p-3 border rounded-lg"
                                defaultValue="OWNER"
                            >
                                <option value="OWNER">OWNER</option>
                                <option value="AGENT">Agent</option>
                                <option value="MANAGER">Manager</option>
                                <option value="FINANCE">Finance</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full mt-6 py-3 bg-[#F47C3C] text-white rounded-lg font-semibold hover:bg-[#E06D2E] disabled:opacity-50"
                        >
                            {submitting ? "Sending..." : "Send Invite"}
                        </button>
                    </form>
                </div>
            )}

            {/* A rejected action (e.g. "You cannot change your own role") — the
                team list stays on screen underneath. */}
            {actionError && !isModalOpen && (
                <div className="flex items-start gap-2 bg-red-50 text-red-600 p-3 rounded-xl text-sm">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p className="flex-1">{actionError}</p>
                    <button
                        onClick={() => setActionError(null)}
                        className="text-red-400 hover:text-red-600"
                        aria-label="Dismiss"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search members..."
                    className="w-full pl-10 p-3 border rounded-xl"
                />
            </div>

            {/* Members Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl">
                    <p className="text-gray-500">
                        {searchQuery ? "No members found" : "No team members yet"}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="mt-3 text-[#F47C3C] hover:underline"
                        >
                            Invite your first member →
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((member) => {
                        const isSelf = member.userId?.email && user?.email && member.userId.email === user.email;
                        const isOwner = member.role === "OWNER";
                        const locked = isSelf || isOwner; // owner / self cannot be suspended, re-roled or removed
                        const busy = actionLoading === member._id;
                        // INVITED members are activated for the first time;
                        // SUSPENDED ones are reinstated. Same endpoint, and the
                        // backend picks the wording for the notification email.
                        const canActivate =
                            member.status === "INVITED" ||
                            (member.status === "SUSPENDED" && !locked);
                        return (
                        <div key={member._id} className="bg-white border p-4 rounded-2xl">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold flex items-center gap-2">
                                        {member.userId?.email}
                                        {isSelf && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">You</span>}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {locked ? (
                                            <span className={`text-xs px-2 py-1 rounded-full ${ROLE_TONE[member.role] || "bg-gray-100 text-gray-700"}`}>
                                                {member.role}
                                            </span>
                                        ) : (
                                            <select
                                                value={member.role}
                                                onChange={(e) => handleRoleChange(member._id, e.target.value)}
                                                disabled={busy}
                                                title="Change role"
                                                className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-white font-medium text-[#0F253B] cursor-pointer hover:border-[#F47C3C] focus:outline-none focus:ring-2 focus:ring-[#F47C3C]/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {ASSIGNABLE_ROLES.map((r) => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        )}
                                        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_TONE[member.status] || "bg-gray-100 text-gray-700"}`}>
                                            {member.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-1">
                                    {canActivate && (
                                        <button
                                            onClick={() => handleActivate(member._id)}
                                            disabled={busy}
                                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                            title={member.status === "SUSPENDED" ? "Reactivate member" : "Activate member"}
                                        >
                                            {busy ?
                                                <Loader2 className="w-4 h-4 animate-spin" /> :
                                                member.status === "SUSPENDED" ?
                                                    <RotateCcw size={16} /> :
                                                    <CheckCircle size={16} />
                                            }
                                        </button>
                                    )}
                                    {member.status === "ACTIVE" && !locked && (
                                        <button
                                            onClick={() => handleSuspend(member._id)}
                                            disabled={busy}
                                            className="p-1 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                                            title="Suspend member"
                                        >
                                            {busy ?
                                                <Loader2 className="w-4 h-4 animate-spin" /> :
                                                <AlertCircle size={16} />
                                            }
                                        </button>
                                    )}
                                    {!locked && (
                                        <button
                                            onClick={() => handleDelete(member._id)}
                                            disabled={busy}
                                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Remove member"
                                        >
                                            {busy ?
                                                <Loader2 className="w-4 h-4 animate-spin" /> :
                                                <Trash2 size={16} />
                                            }
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
