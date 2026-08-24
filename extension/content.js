// Content script — runs on instagram.com, makes API calls with user's session

(function () {
  if (window.__instaUnfollowLoaded) return;
  window.__instaUnfollowLoaded = true;

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function getCSRF() {
    return getCookie('csrftoken') || '';
  }

  async function igFetch(url, options = {}) {
    const headers = {
      'X-CSRFToken': getCSRF(),
      'X-IG-App-ID': '936619743392459',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
    };
    const resp = await fetch(url, { ...options, headers, credentials: 'include' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  async function getProfileInfo() {
    try {
      const resp = await igFetch('https://www.instagram.com/api/v1/accounts/current_user/?edit=true');
      const user = resp?.data?.user || resp;
      if (!user || !user.username) return null;
      return {
        id: user.pk_id || user.id,
        username: user.username,
        following: user.following_count || 0,
        followers: user.follower_count || 0,
      };
    } catch {
      // Fallback: parse from page
      try {
        const resp = await fetch('https://www.instagram.com/', { credentials: 'include' });
        const html = await resp.text();
        const match = html.match(/"profilePage_([0-9]+)"/);
        if (!match) return null;
        const userId = match[1];
        const data = await igFetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${document.cookie.match(/ds_user_id=([^;]+)/)?.[1] ? '' : ''}`);
        // Try direct user lookup
        const profileResp = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${document.title.replace('Instagram', '').trim().split(' ')[0].replace('@', '')}`, { credentials: 'include', headers: { 'X-IG-App-ID': '936619743392459' } });
        const profileData = await profileResp.json();
        const u = profileData?.data?.user;
        if (u) return { id: u.id, username: u.username, following: u.edge_follow?.count || 0, followers: u.edge_followed_by?.count || 0 };
        return { id: userId, username: 'unknown', following: 0, followers: 0 };
      } catch {
        return null;
      }
    }
  }

  async function getUserId() {
    try {
      const resp = await igFetch('https://www.instagram.com/api/v1/accounts/current_user/?edit=true');
      return resp?.data?.user?.pk_id || resp?.pk || null;
    } catch {
      return null;
    }
  }

  async function getFollowingList(userId) {
    const users = [];
    let maxId = '';
    let hasMore = true;
    while (hasMore) {
      const url = `https://www.instagram.com/api/v1/friendships/${userId}/following/?count=50${maxId ? '&max_id=' + maxId : ''}`;
      const data = await igFetch(url);
      if (data?.users) users.push(...data.users.map((u) => u.username));
      maxId = data?.next_max_id || '';
      hasMore = !!maxId;
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
    }
    return users;
  }

  async function getFollowersList(userId) {
    const users = [];
    let maxId = '';
    let hasMore = true;
    while (hasMore) {
      const url = `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=50${maxId ? '&max_id=' + maxId : ''}`;
      const data = await igFetch(url);
      if (data?.users) users.push(...data.users.map((u) => u.username));
      maxId = data?.next_max_id || '';
      hasMore = !!maxId;
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
    }
    return users;
  }

  async function getUserIdByUsername(username) {
    try {
      const data = await igFetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`);
      return data?.data?.user?.id || null;
    } catch {
      return null;
    }
  }

  async function unfollowUser(userId) {
    try {
      await igFetch(`https://www.instagram.com/web/friendships/${userId}/unfollow/`, { method: 'POST' });
      return true;
    } catch {
      return false;
    }
  }

  // Message handler
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      try {
        if (msg.action === 'getProfile') {
          const profile = await getProfileInfo();
          sendResponse({ ok: true, profile });
        } else if (msg.action === 'getFollowing') {
          const userId = msg.userId || await getUserId();
          if (!userId) return sendResponse({ ok: false, error: 'Not logged in' });
          const following = await getFollowingList(userId);
          sendResponse({ ok: true, following, userId });
        } else if (msg.action === 'getFollowers') {
          const userId = msg.userId || await getUserId();
          if (!userId) return sendResponse({ ok: false, error: 'Not logged in' });
          const followers = await getFollowersList(userId);
          sendResponse({ ok: true, followers, userId });
        } else if (msg.action === 'unfollow') {
          const targetUserId = await getUserIdByUsername(msg.username);
          if (!targetUserId) return sendResponse({ ok: false, error: 'User not found' });
          const success = await unfollowUser(targetUserId);
          sendResponse({ ok: success });
        } else {
          sendResponse({ ok: false, error: 'Unknown action' });
        }
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true; // keep message channel open for async response
  });
})();
