import React, { useState } from 'react';
import { BirthDetails, Gender, Language } from '../types';
import { MapPin, Calendar, Clock, User, Phone, Globe2, Sparkles, Image as ImageIcon } from 'lucide-react';

interface ProfileFormProps {
  initialDetails?: BirthDetails;
  onSubmit: (details: BirthDetails) => void;
  isLoading?: boolean;
}

const AVATARS = [
  { id: 'surya', name: 'Surya (Sun)', emoji: '☀️' },
  { id: 'chandra', name: 'Chandra (Moon)', emoji: '🌙' },
  { id: 'ganesha', name: 'Ganesha (Auspicious)', emoji: '🐘' },
  { id: 'lotus', name: 'Kamal (Lotus)', emoji: '🪷' },
  { id: 'mandala', name: 'Mandala (Cosmic)', emoji: '☸️' },
  { id: 'trishul', name: 'Trishula (Protection)', emoji: '🔱' }
];

export default function ProfileForm({ initialDetails, onSubmit, isLoading = false }: ProfileFormProps) {
  const [fullName, setFullName] = useState(initialDetails?.fullName || '');
  const [gender, setGender] = useState<Gender>(initialDetails?.gender || 'male');
  const [dateOfBirth, setDateOfBirth] = useState(initialDetails?.dateOfBirth || '1995-07-23');
  const [timeOfBirth, setTimeOfBirth] = useState(initialDetails?.timeOfBirth || '08:30');
  const [placeOfBirth, setPlaceOfBirth] = useState(initialDetails?.placeOfBirth || 'New Delhi, India');
  const [language, setLanguage] = useState<Language>(initialDetails?.language || 'en');
  const [contactNumber, setContactNumber] = useState(initialDetails?.contactNumber || '');
  const [profilePicture, setProfilePicture] = useState(initialDetails?.profilePicture || 'ganesha');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      fullName,
      gender,
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      language,
      contactNumber,
      profilePicture
    });
  };

  return (
    <form id="profile-form-component" onSubmit={handleSubmit} className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 md:p-8 space-y-6">
      <div className="border-b border-neutral-800 pb-5">
        <h3 className="text-xl font-display font-bold text-gold-100 flex items-center gap-2">
          <Sparkles className="text-saffron-500 w-5 h-5 animate-pulse" />
          Enter Birth Particulars (Janam Vivran)
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          Exact date, time, and coordinates align the Nakshatras and planetary houses for your Kundli.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-gold-300 mb-1.5">Full Name</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-neutral-500" />
            <input
              id="birth-fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Acharya Sharma"
              className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-gold-500 transition"
            />
          </div>
        </div>

        {/* Gender */}
        <div>
          <label className="block text-xs font-semibold text-gold-300 mb-1.5">Gender</label>
          <div className="grid grid-cols-3 gap-2">
            {(['male', 'female', 'other'] as Gender[]).map((g) => (
              <button
                key={g}
                id={`btn-gender-${g}`}
                type="button"
                onClick={() => setGender(g)}
                className={`py-2.5 px-3 rounded-xl text-xs font-medium border capitalize transition ${
                  gender === g
                    ? 'bg-gold-500/10 border-gold-500 text-gold-100 font-bold'
                    : 'bg-[#1b1b24] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Date of Birth */}
        <div>
          <label className="block text-xs font-semibold text-gold-300 mb-1.5">Date of Birth</label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-neutral-500 pointer-events-none" />
            <input
              id="birth-dob"
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-gold-500 transition"
            />
          </div>
        </div>

        {/* Time of Birth */}
        <div>
          <label className="block text-xs font-semibold text-gold-300 mb-1.5">Exact Time of Birth</label>
          <div className="relative">
            <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-neutral-500 pointer-events-none" />
            <input
              id="birth-tob"
              type="time"
              required
              value={timeOfBirth}
              onChange={(e) => setTimeOfBirth(e.target.value)}
              className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-gold-500 transition"
            />
          </div>
        </div>

        {/* Place of Birth */}
        <div>
          <label className="block text-xs font-semibold text-gold-300 mb-1.5">Place of Birth</label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-neutral-500 pointer-events-none" />
            <input
              id="birth-pob"
              type="text"
              required
              value={placeOfBirth}
              onChange={(e) => setPlaceOfBirth(e.target.value)}
              placeholder="e.g., Varanasi, Uttar Pradesh, India"
              className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-gold-500 transition"
            />
          </div>
        </div>

        {/* Contact info */}
        <div>
          <label className="block text-xs font-semibold text-gold-300 mb-1.5">Contact Number (Optional)</label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-neutral-500 pointer-events-none" />
            <input
              id="birth-contact"
              type="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-gold-500 transition"
            />
          </div>
        </div>

        {/* Language Preference */}
        <div>
          <label className="block text-xs font-semibold text-gold-300 mb-1.5">Preferred Language</label>
          <div className="relative">
            <Globe2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-neutral-500 pointer-events-none" />
            <select
              id="birth-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2.5 pl-11 pr-10 text-sm text-white focus:outline-none focus:border-gold-500 transition appearance-none"
            >
              <option value="en">English (Vedic Standard)</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="sa">संस्कृतम् (Sanskrit)</option>
            </select>
          </div>
        </div>

        {/* Profile Avatar / Icon Selector */}
        <div>
          <label className="block text-xs font-semibold text-gold-300 mb-1.5">Cosmic Avatar</label>
          <div className="grid grid-cols-6 gap-1">
            {AVATARS.map((av) => (
              <button
                key={av.id}
                id={`btn-avatar-${av.id}`}
                type="button"
                onClick={() => setProfilePicture(av.id)}
                title={av.name}
                className={`py-2 px-1 rounded-xl text-lg flex items-center justify-center border transition ${
                  profilePicture === av.id
                    ? 'bg-gradient-to-tr from-saffron-600/30 to-gold-400/30 border-gold-500 scale-105'
                    : 'bg-[#1b1b24] border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {av.emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          id="btn-generate-kundli"
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-saffron-600 to-gold-500 hover:from-saffron-500 hover:to-gold-400 text-neutral-950 font-bold py-3.5 px-6 rounded-xl text-sm transition shadow-lg shadow-saffron-900/20 active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 stroke-[2]" />
          {isLoading ? 'Assembling Stars...' : 'Generate Janam Kundli & Forecast'}
        </button>
      </div>
    </form>
  );
}
