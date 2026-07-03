import React from 'react';
import { welcomePack } from '../_data/dummy';

const WelcomePack = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto font-sans text-gray-700">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span>📚</span> Welcome Pack
        </h1>
        <button className="text-gray-500 text-xl">⚙️</button>
      </div>
      <p className="text-sm mb-8">
        Information items and cards added here will be automatically visible to all tenants in each property. 
        You can hide this information at an individual property level if required.
      </p>

      {/* Quick Info Section */}
      <div className="mb-10">
        <h2 className="text-lg font-bold mb-2">Quick Info</h2>
        <p className="text-sm mb-4">Store simple format information such as useful telephone numbers and codes, available for tenants to see.</p>
        {welcomePack.quickInfo.map((q) => (
          <div key={q.id} className="flex justify-between border-b pb-2 mb-4">
            <span>{q.label}: {q.value}</span>
            <span className="text-blue-600 text-sm cursor-pointer underline">Edit | Delete</span>
          </div>
        ))}
        <button className="bg-sky-600 text-white px-4 py-1.5 rounded text-sm font-semibold">Add another item</button>
      </div>

      {/* Info Cards Section */}
      <div className="mb-10">
        <h2 className="text-lg font-bold mb-2">Info Cards</h2>
        <p className="text-sm mb-4">Store cards with more information, rich text, files, images, and videos like a digital information pack, available for tenants to see.</p>
        <div className="flex flex-wrap gap-4">
          {welcomePack.infoCards.map((c) => (
            <div key={c.id} className="border rounded-lg p-4 w-80 shadow-sm">
              <h3 className="font-bold mb-2">{c.title}</h3>
              <p className="text-sm mb-3">{c.description}</p>
              {c.video && <div className="bg-gray-200 h-24 mb-3 flex items-center justify-center text-xs">Video Thumbnail</div>}
              {c.files?.length > 0 && <p className="text-xs text-gray-400 mb-3">📎 {c.files.join(", ")}</p>}
              <div className="flex gap-2">
                <button className="bg-sky-600 text-white px-3 py-1 rounded text-xs">Show more</button>
                <button className="border px-3 py-1 rounded text-xs">Edit</button>
                <button className="border px-3 py-1 rounded text-xs">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Information Card Form */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <h2 className="text-lg font-bold mb-4">New Information Card</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">Title</label>
          <input type="text" className="w-full border rounded p-2" placeholder="Title" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">Description</label>
          <div className="border rounded h-40">
            <div className="bg-gray-50 border-b p-2 text-sm text-gray-500">B I U ⟳ Normal ≡ ≡ ≡ ⌧</div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">Images</label>
          <div className="border-2 border-dashed rounded p-8 text-center text-sm text-gray-400">
            Choose a file or drag it here
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">Files</label>
          <div className="border-2 border-dashed rounded p-8 text-center text-sm text-gray-400">
            Choose a file or drag it here
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-1">Video</label>
          <p className="text-xs text-gray-500 mb-1">Paste in the URL of a public or private Youtube video, e.g. https://www.youtube.com/watch?v=nS9R75FAnj</p>
          <input type="text" className="w-full border rounded p-2" placeholder="Video URL" />
        </div>

        <div className="flex gap-4">
          <button className="bg-pink-700 text-white px-6 py-2 rounded font-semibold">Create</button>
          <button className="text-gray-600">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default WelcomePack;